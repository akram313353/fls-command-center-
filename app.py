import streamlit as st
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
import qrcode
import io
import os
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================
JSON_KEY_FILE = 'credentials.json'  # only used when running locally
SPREADSHEET_NAME = 'FLS_Master_Data'
SHEET_USERS = 'Users'
SHEET_LOGS = 'Login_History'
SHEET_REPORTS = 'Incident_Reports'

PHOTOS_DIR = 'reports/photos'
APP_URL = "your-app-name.streamlit.app"
LOGO_PATH = "logo.png"

CHECKLIST_ITEMS = [
    "Fire extinguisher missing / expired",
    "Blocked emergency exit",
    "Smoke detector fault",
    "Exit sign not lit",
    "Emergency lighting not working",
    "Other (describe below)",
]

LEVELS = ["Level 1", "Level 2", "Level 3", "Roof", "Basement"]

def inject_css():
    st.markdown("""
        <style>
        #MainMenu, footer, header {visibility: hidden;}
        .block-container {padding-top: 2rem; max-width: 480px;}
        div.stButton > button {
            width: 100%;
            border-radius: 8px;
            font-weight: 500;
            padding: 0.6rem 0;
        }
        .stTextInput input, .stTextArea textarea, .stSelectbox div[data-baseweb="select"] {
            border-radius: 8px;
        }
        </style>
    """, unsafe_allow_html=True)


@st.cache_resource
def get_sheet_client():
    try:
        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive"
        ]
        if "gcp_service_account" in st.secrets:
            creds = Credentials.from_service_account_info(
                st.secrets["gcp_service_account"], scopes=scope
            )
        else:
            creds = Credentials.from_service_account_file(JSON_KEY_FILE, scopes=scope)
        client = gspread.authorize(creds)
        return client.open(SPREADSHEET_NAME)
    except Exception as e:
        st.error(f"Connection error: {e}")
        return None


def get_worksheet(name):
    client = get_sheet_client()
    if not client:
        return None
    try:
        return client.worksheet(name)
    except gspread.WorksheetNotFound:
        sheet = client.add_worksheet(title=name, rows=1000, cols=10)
        if name == SHEET_USERS:
            sheet.append_row(["Employee_ID", "Password", "Role", "Created_At"])
        elif name == SHEET_LOGS:
            sheet.append_row(["Login_Time", "Employee_ID", "Status"])
        elif name == SHEET_REPORTS:
            sheet.append_row([
                "Report_ID", "Employee_ID", "Level", "Checklist_Flags",
                "Problem_Description", "Photo_Path", "Timestamp"
            ])
        return sheet


def user_exists(sheet, emp_id):
    data = sheet.get_all_values()
    if not data or len(data) < 2:
        return False
    return any(row[0] == str(emp_id) for row in data[1:])


def register_user(sheet, emp_id, password):
    if user_exists(sheet, emp_id):
        return False
    sheet.append_row([emp_id, password, "Officer", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    return True


def login_user(sheet, emp_id, password):
    data = sheet.get_all_values()
    if not data or len(data) < 2:
        return False
    return any(row[0] == str(emp_id) and row[1] == password for row in data[1:])


def log_login(sheet, emp_id, status):
    sheet.append_row([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), emp_id, status])


def save_report(sheet, emp_id, level, checked_items, description, photo_file):
    report_id = f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    photo_path = "No Image"
    if photo_file:
        os.makedirs(PHOTOS_DIR, exist_ok=True)
        ext = os.path.splitext(photo_file.name)[1] or ".jpg"
        photo_path = os.path.join(PHOTOS_DIR, f"{report_id}{ext}")
        with open(photo_path, "wb") as f:
            f.write(photo_file.getvalue())

    flags = ", ".join(checked_items) if checked_items else "None"

    sheet.append_row([
        report_id, emp_id, level, flags, description,
        photo_path, datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ])
    return report_id


def make_qr_image(level):
    scheme = "https" if "streamlit.app" in APP_URL else "http"
    url = f"{scheme}://{APP_URL}/?level={level.replace(' ', '+')}"
    qr = qrcode.QRCode(version=1, box_size=8, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), url


def main():
    st.set_page_config(page_title="FLS Command Center", layout="centered")
    inject_css()

    if 'logged_in' not in st.session_state:
        st.session_state.logged_in = False
        st.session_state.user_id = None

    query_level = st.query_params.get("level", LEVELS[0])
    if query_level not in LEVELS:
        query_level = LEVELS[0]

    sheet_users = get_worksheet(SHEET_USERS)

    if not st.session_state.logged_in:
        if os.path.exists(LOGO_PATH):
            col = st.columns([1, 1, 1])[1]
            col.image(LOGO_PATH, width=100)

        st.markdown(
            f"<h3 style='text-align:center;'>FLS command center</h3>"
            f"<p style='text-align:center; color:gray;'>Officer login — {query_level}</p>",
            unsafe_allow_html=True
        )

        tab1, tab2 = st.tabs(["Login", "Register"])

        with tab1:
            emp_id = st.text_input("Employee ID", key="login_id")
            password = st.text_input("Password", type="password", key="login_pw")
            if st.button("Login"):
                if not emp_id or not password:
                    st.error("Enter your ID and password.")
                elif sheet_users and login_user(sheet_users, emp_id, password):
                    st.session_state.logged_in = True
                    st.session_state.user_id = emp_id
                    st.session_state.level = query_level
                    log_login(sheet_users, emp_id, "Success")
                    st.rerun()
                else:
                    st.error("Invalid ID or password.")

        with tab2:
            new_id = st.text_input("New employee ID", key="reg_id")
            new_pass = st.text_input("Create password", type="password", key="reg_pw")
            confirm = st.text_input("Confirm password", type="password", key="reg_pw2")
            if st.button("Register"):
                if not new_id or not new_pass:
                    st.error("Fill in all fields.")
                elif new_pass != confirm:
                    st.error("Passwords do not match.")
                elif sheet_users and register_user(sheet_users, new_id, new_pass):
                    st.success("Registered. Please log in.")
                else:
                    st.error("That ID already exists.")

        st.markdown("---")
        st.caption("Not connected to the spreadsheet yet? Preview the app anyway:")
        if st.button("👀 Preview without logging in"):
            st.session_state.logged_in = True
            st.session_state.user_id = "DEMO-001"
            st.session_state.level = query_level
            st.session_state.preview_mode = True
            st.rerun()

        with st.expander("Generate QR codes for each level (admin)"):
            for lvl in LEVELS:
                img_bytes, url = make_qr_image(lvl)
                c1, c2 = st.columns([1, 2])
                c1.image(img_bytes, width=120)
                c2.markdown(f"**{lvl}**")
                c2.caption(url)

    else:
        if st.session_state.get('preview_mode'):
            st.sidebar.warning("Preview mode — not connected to the spreadsheet. Nothing here is saved.")
        st.sidebar.markdown(f"**Officer {st.session_state.user_id}**")
        st.sidebar.caption(f"Level: {st.session_state.get('level', query_level)}")
        is_admin = st.sidebar.checkbox("Admin mode")
        if st.sidebar.button("Log out"):
            st.session_state.logged_in = False
            st.session_state.preview_mode = False
            st.rerun()

        sheet_reports = get_worksheet(SHEET_REPORTS)

        if is_admin:
            st.title("Admin dashboard")
            admin_tab1, admin_tab2 = st.tabs(["Login history", "Incident reports"])
