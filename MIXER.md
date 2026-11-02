# FreeShow Mixer: lớp trộn hình kiểu vMix (bản thử nghiệm)

> Bản fork thử nghiệm của [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow) (GPL-3.0).
> Mục tiêu: dùng FreeShow trên **MacBook** như một bàn trộn hình trực tiếp đơn giản, có Preview/Program, Cut/Auto và multiview giống vMix, đồng thời giữ nguyên toàn bộ tính năng trình chiếu lời và slide của FreeShow.

---

## 1. Ý tưởng kiến trúc

Mixer **không tự dựng engine video riêng**. Nó điều khiển **layer nền (background)** của các Output có sẵn trong FreeShow:

```
 Nguồn vào (Inputs)                 Mixer page                  FreeShow Output (Program)
 ─────────────────                  ──────────                  ─────────────────────────
 Camera USB/HDMI capture ──┐                                     ┌─ Background  ◄── Mixer cắt vào đây
 NDI source (LAN)        ──┼──► Preview ──[CUT / AUTO]──►        ├─ Slide (lời, Kinh Thánh, PPT)  ◄── trang Show
 Màn hình / cửa sổ       ──┤                                     └─ Overlays (lower-third, logo)  ◄── Mixer bật/tắt
 Video / ảnh             ──┘                                              │
                                                                          ├─► Màn chiếu (HDMI)
                                                                          ├─► NDI out / OMT / Blackmagic
                                                                          └─► RTMP livestream + ghi hình (FFmpeg)
```

Lợi ích của cách này:
- **NDI out, livestream RTMP, ghi hình, Blackmagic** chạy ngay, không cần viết thêm. Các pipeline này vốn được gắn theo từng output.
- **Lời bài hát/slide luôn nằm trên** nguồn video, giống downstream key của vMix.
- Phần lõi FreeShow chỉ sửa rất ít (khoảng 20 dòng), nên vẫn dễ merge khi upstream ra bản mới.

---

## 2. Tính năng đã có (MVP)

| Nhóm | Tính năng | Ghi chú |
|---|---|---|
| Inputs | Thêm Camera, NDI, Màn hình, File video/ảnh | Lưu theo máy (localStorage). Đổi tên bằng bấm đúp, sắp xếp ↑↓, xóa |
| Preview | Màn PREVIEW hiển thị **đúng khung hình sắp lên sóng** | Gồm nguồn được chọn, slide đang chiếu và overlay đang bật |
| Program | Màn PROGRAM là bản xem trước của output thật | Dùng lại `PreviewOutput` của FreeShow |
| Chuyển cảnh | **CUT**, **AUTO** (fade, crossfade, blur, scale, slide, spin, fly), chọn thời lượng | Transition đi kèm từng lệnh cut, không ảnh hưởng cài đặt transition chung |
| FTB | Fade To Black cho layer nền | Slide và overlay vẫn giữ |
| Multiview | Lưới thumbnail trực tiếp, tally đỏ (PGM) và xanh (PVW) | Tắt được thumbnail trực tiếp để giảm tải CPU |
| Overlay | Bật/tắt overlay của FreeShow (lower-third, logo, đồng hồ…) | Có hiển thị trạng thái ON AIR |
| Output đích | Chọn 1 output hoặc tất cả output đang bật | |
| Phím tắt | `1–9` đưa nguồn lên Preview, `Shift+1–9` đưa thẳng lên Program, `Space`/`Enter` = AUTO, `C` = CUT, `B` = FTB | Phím `←`/`→` vẫn chuyển slide |
| Ngôn ngữ | Tiếng Anh và tiếng Việt | `public/lang/en.json`, `public/lang/vi.json` |

Mở trang Mixer: nút **Mixer** trên thanh menu, hoặc phím **6**.

---

## 3. Các file đã thay đổi

**File mới**

| File | Vai trò |
|---|---|
| `src/types/Mixer.ts` | Kiểu dữ liệu `MixerInput`, `MixerState`, `MixerTransition` |
| `src/frontend/components/mixer/mixer.ts` | Store và logic: thêm/xóa input, preview, cut, auto, FTB, overlay, phím tắt |
| `src/frontend/components/mixer/Mixer.svelte` | Panel giữa: Preview, thanh chuyển cảnh, Program, Multiview |
| `src/frontend/components/mixer/MixerInputs.svelte` | Panel trái: danh sách nguồn và thêm nguồn |
| `src/frontend/components/mixer/MixerTools.svelte` | Panel phải: output đích, slide, overlay, trạng thái NDI/RTMP |
| `src/frontend/components/mixer/MixerMonitor.svelte` | Màn Preview (render output với `outOverride`) |
| `src/frontend/components/mixer/MixerTile.svelte` | Ô multiview có tally |

**Sửa trong lõi FreeShow (tối thiểu)**

| File | Thay đổi |
|---|---|
| `src/types/Tabs.ts` | Thêm trang `"mixer"` vào `TopViews` |
| `src/types/Show.ts` | Thêm `OutBackground.mixerTransition` |
| `src/frontend/components/output/Output.svelte` | Ưu tiên `mixerTransition` khi đổi nền |
| `src/frontend/MainLayout.svelte` | Gắn 3 panel Mixer |
| `src/frontend/components/main/Top.svelte`, `inputs/TopButton.svelte` | Nút menu Mixer (phím 6) |
| `src/frontend/utils/shortcuts.ts` | Phím tắt của Mixer chỉ chạy khi đang ở trang Mixer |
| `src/frontend/components/output/preview/Preview.svelte` | Không để phím Space/số đồng thời chuyển slide khi ở trang Mixer |
| `src/frontend/values/icons.ts` | Icon `mixer` |

---

## 4. Chạy trên MacBook

Yêu cầu: macOS 12 trở lên, Node.js ≥ 22.12, Xcode Command Line Tools.

```bash
xcode-select --install
```

```bash
git clone <URL fork của bạn> freeshow-mixer
```

```bash
cd freeshow-mixer && npm install
```

```bash
npm start
```

Đóng gói file `.dmg` để cài trên máy (không ký số):

```bash
npm run release:local
```

Lần đầu mở app, cấp quyền tại **System Settings → Privacy & Security**: Camera, Microphone, Screen Recording.

**NDI trên Mac:** cài NDI Tools hoặc NDI Runtime từ ndi.video.
**Livestream / ghi hình:** vào **Settings → Outputs**, chọn output và bật RTMP hoặc Recording. FreeShow tự tải FFmpeg nếu máy chưa có.

---

## 5. Checklist test trước khi dùng thật

- [ ] Tạo 1 output, chọn màn hình HDMI thứ 2, bật output (`Ctrl/Cmd+O`)
- [ ] Mixer → thêm 2 camera và 1 video → kiểm tra thumbnail trực tiếp
- [ ] Bấm ô 1 → PREVIEW hiện camera 1 → `Space` → PROGRAM fade sang camera 1
- [ ] Bấm ô 2 → `C` → cắt ngay, camera 1 tự quay về Preview
- [ ] Sang trang Show, chiếu 1 bài hát → quay lại Mixer → lời hiện trên cả Preview và Program
- [ ] Bật 1 overlay → thấy trạng thái ON AIR, hình ra đúng
- [ ] `B` (FTB) → nền đen, lời vẫn còn
- [ ] Bật NDI cho output → mở NDI Studio Monitor trên máy khác → thấy hình Program
- [ ] Bật RTMP (YouTube/Facebook) → chạy 30 phút, theo dõi CPU, nhiệt độ, rớt khung hình
- [ ] Tắt và mở lại app → danh sách input vẫn còn

---

## 6. Giới hạn hiện tại (nói thẳng)

| Giới hạn | Lý do | Hướng xử lý |
|---|---|---|
| Chỉ 1 nguồn trên Program tại một thời điểm, chưa có PiP hay chia đôi màn hình | Layer nền của output chỉ chứa 1 media | Giai đoạn 2: thêm layer "composition" dùng canvas hoặc WebGL |
| Chưa có T-bar kéo tay | MVP dùng transition theo thời lượng | Giai đoạn 2 |
| Chưa có Instant Replay, MultiCorder (ghi riêng từng nguồn) | Cần engine encode riêng cho từng input | Giai đoạn 3, dùng FFmpeg |
| Chưa có gọi khách mời (kiểu vMix Call) | | Thêm VDO.Ninja làm nguồn "web" hoặc qua NDI |
| Chưa có trộn âm thanh theo từng input | Audio đang đi theo media của output | Dùng Audio mixer có sẵn của FreeShow; giai đoạn 2 thêm fader cho từng input |
| Danh sách input lưu bằng localStorage | Không đồng bộ qua cloud hay profile | Giai đoạn 2: chuyển vào hệ thống save của FreeShow |
| **Chưa chạy thử trên Mac thật** | Môi trường build cloud không tải được Electron headers | Bắt buộc chạy checklist ở mục 5 |

---

## 7. Lộ trình đề xuất

| Giai đoạn | Nội dung | Ước lượng |
|---|---|---|
| 1 (MVP, đã xong) | Preview/Program, Cut/Auto, multiview, overlay, phím tắt | ✅ |
| 2 | PiP và layout nhiều nguồn, T-bar, fader âm thanh cho từng input, lưu cấu hình theo profile, tally qua Bitfocus Companion (HTTP/OSC) | 2–4 tuần |
| 3 | Ghi riêng từng nguồn (ISO record), replay đơn giản, nguồn khách mời qua WebRTC | 4–8 tuần |

---

## 8. Giấy phép

FreeShow dùng giấy phép **GPL-3.0**, nên mọi bản phân phối của fork này **bắt buộc công khai mã nguồn** theo GPL-3.0. Nếu đổi tên hoặc thương hiệu (ví dụ dùng nội bộ F88), vẫn phải giữ ghi chú bản quyền gốc của ChurchApps.
