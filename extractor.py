import requests
from bs4 import BeautifulSoup
import json
import time

# URL ของหน้าเว็บ (เปลี่ยน URL ถ้าตรวจสอบแล้วพบว่าเปลี่ยน)
url = "https://cmi.moph.go.th/report/micro/index.php?menuId=6"  # ถ้า URL เปลี่ยน ให้แก้ที่นี่

# สร้างลิสต์เพื่อเก็บข้อมูลทั้งหมด
all_data = []

# ตั้งค่า Headers
headers = {
    'User-Agent': 'MOPHDataExtractor/1.0 (yourname@example.com)',
    # ถ้าต้องล็อกอิน ให้เพิ่ม Cookie ที่นี่
    # 'Cookie': 'PHPSESSID=your_session_id'
}

try:
    # ส่งคำขอ HTTP
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    print("ดึงหน้าเว็บสำเร็จ!")
    
    # วิเคราะห์ HTML
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # หาตาราง
    tables = soup.find_all('table')
    if tables:
        print(f"พบตาราง {len(tables)} ตารางในหน้าเว็บ")
        table = tables[0]  # เลือกตารางแรก
        
        # ดึงแถวทั้งหมด
        rows = table.find_all('tr')
        
        # ดึงหัวตาราง
        headers_table = [header.text.strip() for header in rows[0].find_all('th')]
        
        # ดึงข้อมูลในแต่ละแถว
        for row in rows[1:]:
            cols = row.find_all('td')
            cols = [col.text.strip() for col in cols]
            row_data = dict(zip(headers_table, cols))
            all_data.append(row_data)
            time.sleep(1)  # รอ 1 วินาที
        
        # กรองข้อมูล (เช่น เฉพาะ Service Plan = M2)
        filtered_data = [row for row in all_data if row.get('Service Plan') == 'M2']
        
        # แปลงเป็น JSON
        json_data = json.dumps(filtered_data, ensure_ascii=False, indent=4)
        
        # บันทึกเป็นไฟล์ JSON
        with open('moph_data.json', 'w', encoding='utf-8') as f:
            f.write(json_data)
        
        print("ข้อมูลที่กรองแล้วถูกบันทึกใน moph_data.json")
    else:
        print("ไม่พบตารางในหน้าเว็บ")
except requests.exceptions.RequestException as e:
    print(f"เกิดข้อผิดพลาดในการดึงหน้าเว็บ: {e}")
except Exception as e:
    print(f"เกิดข้อผิดพลาดทั่วไป: {e}")