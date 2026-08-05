import cv2
import time

cap = cv2.VideoCapture(0)
print("เปิดกล้องแล้ว - หน้าต่างจะโชว์ 5 วินาที (ลองมองหาหน้าต่างชื่อ 'Test Window' ทุกที่บนจอ)")

start = time.time()
while time.time() - start < 5:
    ret, frame = cap.read()
    if ret:
        cv2.imshow("Test Window", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
print("ปิดกล้องแล้ว")