# Hướng dẫn dùng Haidangshow với máy chiếu ngoài (MacBook / Mac mini)

> **Phiên bản:** Haidangshow (bản thử nghiệm dựa trên FreeShow 1.6.8-beta.2) · **Áp dụng:** macOS 13 trở lên, chip Apple M1–M4 hoặc Intel  
> **Đối tượng:** nhân sự vận hành trình chiếu tại sự kiện, hội trường, phòng giao dịch  
> **Mục tiêu:** sau 15 phút, máy chiếu chỉ hiện nội dung trình chiếu (lời, slide, video, camera), còn màn hình Mac giữ bảng điều khiển.

---

## 1. Nguyên tắc cần nhớ

| # | Nguyên tắc | Vì sao |
|---|---|---|
| 1 | Màn hình Mac dùng để **điều khiển**, máy chiếu dùng để **trình chiếu** | Khán giả chỉ thấy nội dung, không thấy thao tác |
| 2 | macOS phải để chế độ **mở rộng màn hình (Extended)**, **không** để Mirror (nhân bản) | Ở chế độ Mirror, khán giả thấy toàn bộ thao tác điều khiển |
| 3 | Nội dung chỉ lên máy chiếu khi bấm **Trình bày** (`Cmd+O`) | Tránh lộ nội dung chưa sẵn sàng |
| 4 | Luôn **chạy thử trước 30 phút** tại đúng địa điểm, đúng máy chiếu, đúng cáp | Lỗi hay gặp nhất là cáp, adapter và độ phân giải |

---

## 2. Chuẩn bị thiết bị

| Thiết bị | Yêu cầu | Ghi chú |
|---|---|---|
| Mac | Đã cài Haidangshow ([tải tại đây](https://github.com/Manhmamanh/FreeShow/releases/tag/mixer-latest)) | M1–M4: bản `arm64`, Intel: bản `x64` |
| Cáp/adapter | **USB-C (Thunderbolt) → HDMI**. Mac mini/MacBook Pro đời mới có sẵn cổng HDMI | Nên dùng adapter hỗ trợ 4K@60Hz. Mang theo 1 adapter dự phòng |
| Cáp HDMI | Dài tối đa khoảng 10 m (cáp thường). Xa hơn thì dùng HDMI có khuếch đại hoặc bộ kéo dài HDMI qua cáp LAN | Cáp dài kém chất lượng hay gây nháy hình, mất hình |
| Máy chiếu | Có cổng HDMI. Độ phân giải gốc thường là 1920×1080 hoặc 1280×800 | Xem nhãn máy hoặc menu Info của máy chiếu |
| Âm thanh | Nếu cần tiếng: loa máy chiếu, loa rời, hoặc mixer âm thanh | Xem mục 7 |
| Chuột/remote | Remote trình chiếu (clicker) loại phát phím ← → | Dùng để chuyển slide khi đứng xa máy |

**Sơ đồ kết nối:**

```
 [Mac: bảng điều khiển Haidangshow] ──USB-C→HDMI──► [Máy chiếu] ──► [Màn chiếu]
            │
            └── (tuỳ chọn) Loa / mixer âm thanh qua jack 3.5 hoặc USB
```

---

## 3. Kết nối máy chiếu và cài đặt macOS

1. **Bật máy chiếu trước**, chọn nguồn vào (Source/Input) là **HDMI**.
2. Cắm cáp HDMI vào máy chiếu, sau đó mới cắm adapter vào Mac.
3. Trên Mac, mở ** → System Settings → Displays**.
4. Phải thấy **2 màn hình**: màn hình Mac và máy chiếu (thường mang tên hãng như Epson, Sony, Panasonic…).
5. Chọn máy chiếu, ở mục **Use as** chọn **Extended display** (mở rộng). **Không** chọn "Mirror for…".
6. Bấm **Arrange…** để kéo vị trí máy chiếu (thường đặt bên phải màn hình Mac). Thanh trắng trên cùng là màn hình chính: để nó ở **màn hình Mac**.
7. Ở mục **Resolution** của máy chiếu, chọn **Default for display** hoặc đúng độ phân giải gốc (1920×1080 hoặc 1280×800).

> ⚠️ Nếu không thấy máy chiếu: rút adapter ra cắm lại, đổi cổng USB-C, hoặc giữ phím **Option** để hiện nút **Detect Displays** trong cửa sổ Displays.

---

## 4. Thiết lập đầu ra (output) trong Haidangshow, chỉ làm một lần

1. Mở **Haidangshow**.
2. Bấm biểu tượng **Cài đặt** (⚙, góc trên bên phải) → tab **Đầu ra**.
3. Nếu chưa có đầu ra nào: bấm **Thêm / Đầu ra mới**.
4. Ở **Màn hình đầu ra**, bấm vào ô hình chữ nhật đại diện cho **máy chiếu** trong sơ đồ màn hình. Hướng dẫn trên app ghi: *"Nhấp vào màn hình nơi bạn muốn hiển thị cửa sổ đầu ra."*
   - Không chắc ô nào là máy chiếu: bấm **Nhận diện màn hình**, mỗi màn hình sẽ hiện số thứ tự.
5. Bật các tuỳ chọn nên dùng khi chiếu:

| Tuỳ chọn | Nên đặt | Tác dụng |
|---|---|---|
| **Luôn ở trên cùng** | Bật | Cửa sổ trình chiếu không bị app khác che |
| **Ẩn con trỏ ở đầu ra** | Bật | Không thấy chuột trên màn chiếu |
| **Độ phân giải** | Đúng độ phân giải gốc của máy chiếu (thường 1920×1080) | Chữ và hình sắc nét, không méo |
| **Kích hoạt màn hình đầu ra khi khởi động** | Bật nếu dùng cố định một máy chiếu | Mở app là tự lên máy chiếu |

6. Đặt tên đầu ra dễ nhớ, ví dụ **"Máy chiếu hội trường"**.

> ℹ️ Muốn chiếu ra 2 máy chiếu (hoặc thêm 1 TV sân khấu): tạo thêm đầu ra mới và chọn màn hình tương ứng.

---

## 5. Bật / tắt trình chiếu

| Thao tác | Cách làm |
|---|---|
| **Bật trình chiếu** | Bấm nút **Trình bày** (góc trên bên phải) hoặc `Cmd+O` |
| **Tắt trình chiếu** | Bấm **Dừng trình bày** (bấm 2 lần để xác nhận) hoặc `Cmd+O` |
| Ẩn nhanh cửa sổ trình chiếu | Nhấp đúp vào cửa sổ trình chiếu trên máy chiếu |
| Xoá nội dung đang chiếu | Dùng các nút xoá dưới khung Preview bên phải (slide / nền / overlay / tất cả) |
| Màn hình đen tạm thời | Trang Mixer: phím `B` (FTB). Hoặc xoá tất cả nội dung |

> ✅ Khi trình chiếu đang bật mà chưa có nội dung, máy chiếu sẽ hiện **màn đen**. Đây là trạng thái chờ an toàn.

---

## 6. Trình chiếu nội dung

### 6.1. Lời bài hát, slide, Kinh Thánh (trang **Trình chiếu**)
1. Bấm **Trình chiếu** trên thanh menu (phím `1`).
2. Chọn dự án và show ở cột trái, bấm vào slide để đưa lên máy chiếu.
3. Chuyển slide: phím `→` / `←`, `Space`, hoặc remote clicker.
4. Khung Preview bên phải chính là **thứ khán giả đang thấy**.

### 6.2. Các loại file và cách mở

| Loại file | Mở ở đâu | Ghi chú |
|---|---|---|
| Ảnh, video (`.jpg .png .mp4 .mov`…) | Ngăn **Media** dưới trang Trình chiếu, hoặc kéo vào dự án | Trang Mixer: **+ Thêm nguồn → File media / âm thanh** |
| **PDF** | Kéo thả vào **dự án** (cột trái trang Trình chiếu) | Chiếu từng trang như slide |
| **PowerPoint / Keynote** (`.ppt .pptx .key`) | Kéo vào dự án (chuyển thành slide), hoặc **Nhập → PowerPoint → PDF** (giữ nguyên bố cục) | Cần **Keynote** (miễn phí trên Mac), LibreOffice hoặc PowerPoint |
| **Word / Excel** (`.doc .docx .xls .xlsx`), Pages, Numbers | Kéo thả vào **dự án**: app tự chuyển sang **PDF** rồi thêm vào dự án | Cần **Pages / Numbers** (miễn phí trên Mac), LibreOffice hoặc Microsoft Office |
| **Âm thanh** (`.mp3 .wav .m4a .aac .flac`…) | Ngăn **Âm thanh** dưới trang Trình chiếu, hoặc trang Mixer: **+ Thêm nguồn → File media / âm thanh** | Trong Mixer: nút **▶ PLAY / ⏸ PAUSE**, LOOP, fader âm lượng |

> ⚠️ Lần đầu chuyển Word/Excel/PowerPoint bằng Keynote/Pages/Numbers, macOS sẽ hỏi *"Haidangshow muốn điều khiển Keynote/Pages/Numbers"*: bấm **OK**. Lỡ bấm từ chối: **System Settings → Privacy & Security → Automation → Haidangshow**, bật lại.
>
> ℹ️ Chưa có Keynote/Pages/Numbers: tải miễn phí trên **App Store**. Hoặc cài **LibreOffice** (miễn phí, libreoffice.org).

### 6.3. Camera, khách mời, PiP (trang **Mixer**)
1. Bấm **Mixer** trên thanh menu (phím `6`).
2. **+ Thêm nguồn** → Camera / NDI / Màn hình / Micro / Khách mời / File media.
3. Bấm ô nguồn để đưa lên **PREVIEW**, rồi `Space` (AUTO) hoặc `C` (CUT) để lên **PROGRAM**, tức máy chiếu.
4. Lời bài hát và slide từ trang Trình chiếu **luôn nằm trên** hình camera.
5. Chi tiết xem `MIXER.md`.

---

## 7. Âm thanh qua máy chiếu hoặc loa

1. ** → System Settings → Sound → Output**, chọn thiết bị phát:
   - **Máy chiếu (HDMI)**: tiếng ra loa của máy chiếu.
   - **Loa rời / mixer âm thanh**: chọn thiết bị tương ứng (jack 3.5, USB audio).
2. Trong Haidangshow: **Cài đặt → Âm thanh** để chọn thiết bị ra và mức âm lượng.
3. Thử phát một video có tiếng **trước khi** khán giả vào.

> ⚠️ Một số máy chiếu không có loa, hoặc loa rất nhỏ. Với hội trường, nên đưa tiếng ra mixer âm thanh của hội trường.

---

## 8. Phím tắt hay dùng

| Phím | Tác dụng |
|---|---|
| `Cmd+O` | Bật / tắt trình chiếu ra máy chiếu |
| `→` / `←` / `Space` | Slide tiếp / trước |
| `1` | Trang Trình chiếu |
| `6` | Trang Mixer |
| `Esc` | Đóng popup / bỏ chọn |
| Trang Mixer: `1`–`9` | Đưa nguồn lên Preview |
| Trang Mixer: `Space` / `C` / `B` | AUTO / CUT / màn đen (FTB) |

---

## 9. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Máy chiếu báo "No Signal" | Sai nguồn vào, cáp lỏng, adapter lỗi | Chọn đúng nguồn **HDMI** trên máy chiếu, cắm lại cáp, thử adapter dự phòng |
| Máy chiếu hiện y hệt màn hình Mac | macOS đang ở chế độ **Mirror** | System Settings → Displays → máy chiếu → **Use as: Extended display** |
| Nội dung hiện trên màn hình Mac thay vì máy chiếu | Chọn sai **Màn hình đầu ra** | Cài đặt → Đầu ra → bấm lại đúng ô máy chiếu (dùng **Nhận diện màn hình**) |
| Hình bị cắt mép, méo, viền đen | Sai độ phân giải hoặc tỉ lệ (16:9 / 16:10 / 4:3) | Đặt độ phân giải đầu ra bằng độ phân giải gốc máy chiếu. Tắt chế độ zoom/keystone quá mức trên máy chiếu |
| Hình nháy hoặc chập chờn | Cáp dài, cáp kém, adapter không đủ băng thông | Dùng cáp ngắn hơn hoặc cáp có khuếch đại, giảm độ phân giải xuống 1920×1080@60Hz |
| Thấy con trỏ chuột trên màn chiếu | Chưa bật **Ẩn con trỏ ở đầu ra** | Bật trong Cài đặt → Đầu ra |
| Cửa sổ app khác che màn chiếu | Chưa bật **Luôn ở trên cùng** | Bật trong Cài đặt → Đầu ra |
| Không có tiếng | Sai thiết bị âm thanh | System Settings → Sound → Output, và Cài đặt → Âm thanh trong app |
| Camera đen trong Mixer | Chưa cấp quyền Camera | System Settings → Privacy & Security → **Camera** → bật Haidangshow, rồi mở lại app |
| App mở rồi tắt ngay | Bản tải về bị macOS gắn cờ cách ly (quarantine) | Chạy lệnh `xattr -cr /Applications/Haidangshow.app` rồi mở lại |
| Word/Excel/PPT không mở được | Máy chưa có Keynote/Pages/Numbers, LibreOffice hoặc Office, hoặc đã từ chối quyền Automation | Cài Pages/Numbers/Keynote (App Store, miễn phí), hoặc bật lại quyền ở **Privacy & Security → Automation** |
| File âm thanh không thêm được vào Mixer | Bản Haidangshow cũ (trước 03/11) | Cập nhật bản mới nhất |
| Mac ngủ hoặc tắt màn hình giữa chừng | Cài đặt tiết kiệm pin | System Settings → Lock Screen / Displays: tắt tự tắt màn hình khi đang chạy sự kiện. MacBook: cắm sạc |

---

## 10. Checklist trước sự kiện

**Trước 1 ngày**
- [ ] Cập nhật bản Haidangshow mới nhất, mở thử được
- [ ] Chuẩn bị đủ nội dung: show lời bài hát, slide, video, logo, overlay
- [ ] Sạc đầy MacBook, chuẩn bị adapter và cáp HDMI dự phòng

**Trước 30 phút, tại địa điểm**
- [ ] Máy chiếu bật, chọn nguồn HDMI, lấy nét, chỉnh keystone
- [ ] macOS ở chế độ **Extended display**, đúng độ phân giải
- [ ] Haidangshow: đầu ra trỏ đúng máy chiếu, bật **Luôn ở trên cùng** và **Ẩn con trỏ**
- [ ] `Cmd+O` → máy chiếu hiện màn đen, chưa lộ nội dung
- [ ] Chiếu thử 1 slide lời, 1 video có tiếng, 1 ảnh: kiểm tra đủ chữ, không bị cắt mép
- [ ] Đứng cuối phòng: chữ có đọc được không (cỡ chữ, độ tương phản)
- [ ] Thử remote clicker chuyển slide
- [ ] Tắt thông báo: Control Center → **Do Not Disturb** (tránh popup che màn hình)
- [ ] Đóng các app không cần thiết (Zalo, Mail…)

**Trong sự kiện**
- [ ] Theo dõi khung Preview: đó là thứ khán giả đang thấy
- [ ] Cần tạm ngưng: dùng màn đen (FTB `B` ở trang Mixer, hoặc xoá tất cả nội dung)

**Sau sự kiện**
- [ ] `Cmd+O` tắt trình chiếu trước khi rút cáp
- [ ] Lưu show (`Cmd+S`), sao lưu thư mục `~/Documents/Haidangshow` nếu có thay đổi quan trọng

---

## 11. Điểm cần xác nhận khi dùng thực tế

| Mục | Trạng thái |
|---|---|
| Vị trí nút **Trình bày** và các tuỳ chọn trong **Cài đặt → Đầu ra** | Lấy theo tên menu trong app. Vị trí có thể khác chút giữa các phiên bản |
| Âm thanh qua HDMI máy chiếu | Tuỳ từng máy chiếu, cần thử tại chỗ |
| Trang Mixer (camera, khách mời, PiP) | Bản thử nghiệm, nên chạy thử đầy đủ trước khi dùng cho sự kiện quan trọng |

---

*Haidangshow dựa trên FreeShow © ChurchApps (GPL-3.0).*
