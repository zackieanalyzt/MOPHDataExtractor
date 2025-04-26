import requests
from bs4 import BeautifulSoup
import json
import datetime

url = "https://cmi.moph.go.th/report/micro/index.php?menuId=6"
all_data = []

headers = {
    'User-Agent': 'MOPHDataExtractor/1.0 (yourname@example.com)',
}

try:
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.content, 'html.parser', from_encoding='utf-8')
    tables = soup.find_all('table')
    if not tables:
        print("ไม่พบตารางในหน้าเว็บ")
        exit(1)

    table = tables[0]
    rows = table.find_all('tr')
    if not rows or not rows[0].find_all('th'):
        print("ไม่พบหัวตารางในตารางแรก")
        exit(1)

    headers_table = [header.text.strip() for header in rows[0].find_all('th')]
    for row in rows[1:]:
        cols = row.find_all('td')
        if len(cols) != len(headers_table):
            print(f"ข้ามแถวที่มีจำนวนคอลัมน์ไม่ตรงกับหัวตาราง: {cols}")
            continue
        cols = [col.text.strip() for col in cols]
        row_data = dict(zip(headers_table, cols))
        all_data.append(row_data)

    filtered_data = [row for row in all_data if row.get('Service Plan') == 'M2']
    json_data = json.dumps(filtered_data, ensure_ascii=False, indent=4)

    filename = f"moph_data_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(json_data)

    print(f"ข้อมูลที่กรองแล้วถูกบันทึกใน {filename}")
except requests.exceptions.RequestException as e:
    print(f"เกิดข้อผิดพลาดในการดึงหน้าเว็บ: {e}")
except Exception as e:
    print(f"เกิดข้อผิดพลาดทั่วไป: {e}")