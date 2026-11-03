# Haidangshow: trình chiếu và bàn trộn hình kiểu vMix (bản thử nghiệm)

> **Haidangshow** là bản fork của [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow) (GPL-3.0), thêm trang Mixer kiểu vMix.
> Cài **song song** được với FreeShow gốc: tên app, `appId` (`app.haidangshow`), thư mục cài đặt và thư mục dữ liệu (`~/Documents/Haidangshow`) đều riêng.
> Mục tiêu: dùng FreeShow trên **MacBook** như một bàn trộn hình trực tiếp, có Preview/Program, Cut/Auto/T-bar, hình trong hình (PiP), trộn âm thanh, replay, ghi ISO và khách mời từ xa. Toàn bộ tính năng trình chiếu lời và slide của FreeShow vẫn giữ nguyên.

---

## 1. Kiến trúc

```
 Nguồn vào (Inputs)            Trang Mixer (cửa sổ chính)                  Mỗi Output (cửa sổ output)
 ─────────────────             ──────────────────────────                  ─────────────────────────────
 Camera USB/HDMI capture ─┐    Preview ─[CUT / AUTO / T-BAR / FTB]─►        ┌─ Overlays (lower-third, logo)  ◄ Mixer bật/tắt
 NDI / OMT / Blackmagic   ─┤    PiP (hình trong hình, chia đôi)  ───►        ├─ Slide (lời, Kinh Thánh, PPT)  ◄ trang Show
 Màn hình / cửa sổ        ─┤                                                ├─ Background của FreeShow
 Video / ảnh              ─┼──► out.mixer = { program, next, T-bar, PiP } ─► └─ LỚP MIXER (mới): A → B + các ô PiP
 Clip replay              ─┤                                                         │
 Khách mời (VDO.Ninja)    ─┤    Âm thanh: video, micro, replay ──► bộ trộn âm thanh FreeShow ──► loa / NDI / RTMP / ghi hình
 Micro / sound card       ─┘    Ghi: ISO từng camera, bộ đệm replay ──► thư mục Recordings
```

- **Lớp Mixer** là một layer mới trong mọi output, nằm **dưới** background, slide và overlay của FreeShow. Nhờ vậy lời bài hát luôn nằm trên hình, giống downstream key của vMix.
- Output vẫn là output của FreeShow, nên **NDI out, RTMP livestream, ghi Program, Blackmagic** chạy như cũ.
- **T-bar** gửi vị trí qua một tin nhắn IPC nhẹ (`MIXER_LIVE`) thay vì cập nhật toàn bộ `outputs`, nên kéo mượt mà không làm nặng app.
- **Âm thanh** được phát ở cửa sổ chính và nối vào `AudioAnalyser` của FreeShow, nên đi đúng đường của âm thanh FreeShow: loa, NDI, RTMP, ghi hình.

---

## 2. Tính năng

| Nhóm | Tính năng | Cách dùng |
|---|---|---|
| Nguồn | Camera, NDI, OMT, Blackmagic, màn hình, video, ảnh, micro, khách mời, clip replay | Panel trái → **Thêm nguồn**. Bấm đúp để đổi tên |
| Chuyển cảnh | **CUT**, **AUTO** với 10 kiểu: fade, crossfade, wipe, slide, push, scale, blur, fly, spin, none | Phím `C`, `Space`/`Enter` |
| **T-bar** | Kéo tay: Preview hòa dần vào Program, kéo hết hành trình là nhận nguồn. Dừng giữa chừng thì giữ nguyên trạng thái | Kéo cần gạt ở cột giữa |
| FTB | Fade To Black dạng bật/tắt: bấm lần nữa thì quay lại nguồn trước. Slide và overlay vẫn giữ | Phím `B` |
| **PiP** | Nhiều ô hình trong hình, 8 vị trí có sẵn, chỉnh X/Y/kích thước/viền/bo góc/màu viền, kiểu lấp đầy hoặc vừa khung, **chia đôi màn hình** 1 chạm | Tab **PiP**, nút ON AIR cho từng ô |
| **Âm thanh** | Fader cho từng nguồn (0–150%), MUTE, **AFV** (tiếng theo hình, có crossfade theo chuyển cảnh) hoặc LUÔN BẬT, gắn micro cho camera, đồng hồ mức cho micro | Tab **Âm thanh** |
| **Replay** | Bộ đệm cho từng camera (tối đa 30 giây gần nhất), chọn độ dài 5–30 giây, tốc độ 0.25×–1×, tự quay về camera trước khi clip hết | Tab **Replay & ISO**, phím `R` |
| **ISO** | Ghi riêng từng camera thành file riêng, kèm micro đi kèm. Ghi dần xuống ổ đĩa nên không đầy RAM | Tab **Replay & ISO** |
| Ghi Program | Ghi hình đầu ra gồm slide, overlay, âm thanh (dùng chức năng ghi output có sẵn của FreeShow) | Tab **Replay & ISO** |
| **Khách mời** | Tạo link và mã QR, khách mở bằng trình duyệt điện thoại/laptop. Hình khách thành một nguồn, chỉnh được âm lượng | Tab **Khách mời** |
| **FX / Key** | **Chroma key** (phông xanh lá/xanh dương, độ tương đồng, độ mềm cạnh, khử ám màu), **chỉnh màu** (sáng, tương phản, bão hòa, gamma, tông màu, nhiệt độ màu), **LUT 3D .cube** (có cường độ). Chạy bằng shader WebGL2, hiện trên Preview, Program, output, NDI và file ghi | Nút **🎨 FX / Key** ở thanh dưới, hoặc nút **FX** trên ô nguồn |
| Multiview | Hình thu nhỏ trực tiếp, tally: đỏ = PGM, xanh = PVW, cam = PiP, ● REC | Bấm = Preview, bấm đúp = lên thẳng Program |
| Phím tắt | `1–9` Preview, `Shift+1–9` lên thẳng Program, `Space`/`Enter` AUTO, `C` CUT, `B` FTB, `R` REPLAY, `←`/`→` chuyển slide | Chỉ có tác dụng khi đang ở trang Mixer. Mở trang Mixer: phím `6` |

---

## 3. Tải bản build sẵn cho Mac

Trang tải: **https://github.com/Manhmamanh/FreeShow/releases/tag/mixer-latest**

Link trực tiếp:
- M1/M2/M3/M4: https://github.com/Manhmamanh/FreeShow/releases/download/mixer-latest/Haidangshow-arm64.dmg
- Intel: https://github.com/Manhmamanh/FreeShow/releases/download/mixer-latest/Haidangshow-x64.dmg

| Máy | File |
|---|---|
| M1/M2/M3/M4 | `Haidangshow-arm64.dmg` |
| Intel | `Haidangshow-x64.dmg` |

Mỗi lần đẩy code lên nhánh `feature/mixer-*`, GitHub Actions (`.github/workflows/mixer-mac.yml`) sẽ build lại và thay file trên trang Releases.

Cài đặt:
1. Mở file `.dmg`, kéo Haidangshow vào Applications.
2. Bản build thử chưa được Apple xác thực (notarize), nên chạy lệnh này một lần trước khi mở:

```bash
xattr -cr /Applications/Haidangshow.app
```

3. Mở app, cấp quyền **Camera, Micro, Screen Recording** khi được hỏi.

> ℹ️ Haidangshow có dữ liệu riêng, không đụng tới FreeShow gốc. Muốn dùng lại bài hát/show từ FreeShow: copy thư mục `~/Documents/FreeShow` sang `~/Documents/Haidangshow` khi app đang tắt.
> ⚠️ Workflow `release.yml` có sẵn của FreeShow tự chạy khi push lên `main`. Tắt workflow đó trước khi merge nhánh Mixer vào `main`.

Chạy từ mã nguồn (cần Node.js ≥ 22.12 và Xcode Command Line Tools):

```bash
npm install
```

```bash
npm start
```

---

## 4. Hướng dẫn nhanh theo tình huống

**Talkshow 2 camera + khách online**
1. Thêm Camera 1, Camera 2. Vào tab **Âm thanh** gắn micro cho từng camera.
2. Tab **Khách mời** → Thêm khách mời → gửi link hoặc QR cho khách.
3. Tab **PiP** → chọn Khách mời → Thêm PiP → vị trí ↘ → ON AIR.
4. Chuyển giữa 2 camera bằng `1`/`2` + `Space`. Khung hình khách nằm ở góc.

**Phỏng vấn chia đôi màn hình**: tab PiP → **Chia đôi màn hình**. Hai nguồn đầu tiên được đặt cạnh nhau và tự bật ON AIR.

**Thể thao / sự kiện có quay chậm**
1. Tab **Replay & ISO** → bật BUFFER cho các camera.
2. Có pha hay: bấm `R` → clip tự xuất hiện ở Preview → `Space` để phát chậm.
3. Clip hết thì tự quay về camera trước (bỏ tick nếu muốn tự chuyển).

**Xóa phông (green screen)**
1. Thêm camera quay người trước phông xanh, và một video hoặc ảnh làm nền.
2. Nút **FX** trên ô camera → bật **Chroma key** → chọn **Phông xanh lá** → kéo **Độ tương đồng** tới khi phông biến mất, **Độ mềm cạnh** cho viền mịn, **Khử ám màu** để bỏ ánh xanh trên tóc và vai.
3. Đưa video nền lên **Program**. Tab **PiP** → thêm PiP với camera → chọn vị trí **⛶** (toàn màn hình) → ON AIR.
4. Ô thu nhỏ ở multiview vẫn hiện phông xanh (cho nhẹ máy). Phải nhìn **Preview/Program** để thấy kết quả xóa phông.

**Ghi để dựng lại sau**: bấm **Ghi tất cả camera** (ISO) và **Ghi Program** cùng lúc. File nằm trong `Recordings/Mixer ISO`.

---

## 5. Các file thay đổi

**File mới**

| File | Vai trò |
|---|---|
| `src/types/Mixer.ts` | Kiểu dữ liệu: input, PiP, transition, `OutMixer` |
| `src/frontend/components/mixer/mixer.ts` | Trạng thái và logic: nguồn, Cut/Auto/T-bar/FTB, PiP, replay, phím tắt |
| `src/frontend/components/mixer/mixerLive.ts` | Dùng chung cho cửa sổ chính và output: tiến độ chuyển cảnh, easing, kiểu chuyển cảnh, AFV, link khách |
| `src/frontend/components/mixer/mixerLive.test.ts` | 12 unit test cho phần logic trên |
| `src/frontend/components/mixer/mixerAudio.ts` | Âm thanh: video, micro, replay → bộ trộn âm thanh FreeShow, đồng hồ mức |
| `src/frontend/components/mixer/mixerRecorder.ts` | Ghi ISO, bộ đệm replay, tạo clip replay |
| `src/frontend/components/mixer/output/MixerLayer.svelte` | Lớp Mixer trong output: A/B + PiP |
| `src/frontend/components/mixer/output/MixerSource.svelte` | Vẽ một nguồn (camera, NDI, video, khách...) |
| `src/frontend/components/mixer/Mixer*.svelte` | Giao diện: trang chính, T-bar, các tab, nguồn, panel phải |
| `src/electron/mixer/mixerFiles.ts` | Tiến trình chính: ghi file ISO, ghép replay bằng FFmpeg |
| `.github/workflows/mixer-mac.yml` | Build `.dmg` cho Mac |

**Sửa trong lõi FreeShow**

| File | Thay đổi |
|---|---|
| `src/types/Output.ts` | `OutData.mixer` |
| `src/types/Tabs.ts` | Trang `"mixer"` |
| `src/types/IPC/Main.ts`, `src/electron/IPC/responsesMain.ts` | 2 lệnh IPC: `MIXER_ISO_CHUNK`, `MIXER_SAVE_REPLAY` |
| `src/frontend/components/output/Output.svelte` | Vẽ `MixerLayer` dưới layer background |
| `src/frontend/utils/receivers.ts` | Nhận `MIXER_LIVE` (T-bar) trong cửa sổ output |
| `src/frontend/MainLayout.svelte`, `main/Top.svelte`, `inputs/TopButton.svelte` | Nút và layout trang Mixer |
| `src/frontend/utils/shortcuts.ts`, `output/preview/Preview.svelte` | Phím tắt riêng của trang Mixer |
| `src/frontend/values/icons.ts`, `public/lang/en.json`, `public/lang/vi.json` | Icon và bản dịch |

---

## 6. Checklist test trên Mac

**Cơ bản**
- [ ] Thêm 2 camera + 1 video → thấy thumbnail trực tiếp
- [ ] `1` → `Space`: fade sang camera 1. `2` → `C`: cắt ngay
- [ ] Thử lần lượt từng kiểu chuyển cảnh trong danh sách
- [ ] Kéo T-bar xuống một nửa → Program hiện 50/50 → kéo hết → nhận nguồn. Kéo lại lần nữa thì đi theo chiều ngược lại
- [ ] Chiếu 1 bài hát ở trang Show → lời nằm trên hình camera. `B` → nền đen, lời vẫn còn. `B` lần nữa → quay lại camera

**PiP**
- [ ] Thêm PiP góc ↘ → ON AIR → hiện trên Preview, Program và output thật
- [ ] Kéo X/Y/kích thước, viền, bo góc → output cập nhật ngay
- [ ] Chia đôi màn hình với 2 camera

**Âm thanh**
- [ ] Video có tiếng: chỉ nghe khi lên Program (AFV). Chuyển sang LUÔN BẬT → nghe cả khi không lên hình
- [ ] Gắn micro cho camera → đồng hồ mức chạy → chuyển camera thì tiếng đi theo
- [ ] Bật RTMP hoặc ghi Program → kiểm tra file hoặc luồng stream có tiếng

**Replay & ISO**
- [ ] Bật BUFFER camera 1 → chờ 10 giây → `R` → clip xuất hiện ở Preview → `Space` → phát chậm 0.5× → tự quay về camera trước
- [ ] Ghi ISO 2 camera trong 1 phút → mở `Recordings/Mixer ISO` → 2 file phát được trong QuickTime/VLC

**Khách mời**
- [ ] Thêm khách → quét QR bằng điện thoại → cho phép camera → hình khách hiện ở multiview và lên Program được
- [ ] Chỉnh fader khách → âm lượng thay đổi

---

## 7. Giới hạn hiện tại

| Giới hạn | Chi tiết | Hướng xử lý |
|---|---|---|
| **Chưa chạy thử trên Mac thật** | Môi trường build cloud không chạy được Electron có giao diện. Đã kiểm tra bằng: build production, svelte-check, eslint, 12 unit test, thử lệnh FFmpeg ghép replay | Chạy checklist ở mục 6 |
| Khách mời cần Internet, dùng máy chủ báo hiệu (signaling) công cộng của VDO.Ninja | Mặc định nhận **trực tiếp qua WebRTC** (SDK VDO.Ninja, MPL-2.0): hình là `<video>` thường nên lên được NDI/RTMP, tiếng đi qua bàn trộn âm thanh | Nếu không kết nối được, bật "Chế độ tương thích (webview)" cho khách đó |
| Tiếng NDI/OMT chưa có fader riêng | Tiếng NDI do FreeShow xử lý riêng | Giai đoạn sau |
| Replay và ISO chỉ áp dụng cho nguồn **camera** | NDI/màn hình/khách chưa ghi riêng được | Dùng Ghi Program, hoặc ghi ở thiết bị nguồn |
| Đồng bộ tiếng–hình của video | Hình phát ở output, tiếng phát ở cửa sổ chính, cùng bắt đầu nhưng có thể lệch vài chục ms với video dài | Nên dùng cho clip ngắn hoặc nhạc nền |
| Replay ghép bằng FFmpeg | Nếu máy chưa có FFmpeg, clip chỉ còn đoạn 2 giây cuối. FreeShow tự tải FFmpeg khi bật RTMP lần đầu | Bật RTMP một lần để FreeShow tải FFmpeg |
| Tải CPU | Mỗi camera bật bộ đệm replay **và** ISO bị mã hóa 2 lần | Máy M1/M2 cơ bản: nên tối đa 2–3 camera bật cả hai |
| Khách mời cần Internet và dùng dịch vụ VDO.Ninja công cộng | Ai có link đều gửi được hình vào nguồn đó | Chỉ gửi link cho đúng khách; bấm ⟳ để đổi link sau mỗi buổi |
| Danh sách nguồn lưu bằng localStorage | Không đồng bộ qua cloud hay profile | Giai đoạn sau |

---

## 8. Giấy phép

FreeShow dùng giấy phép **GPL-3.0**, nên mọi bản phân phối của fork này **bắt buộc công khai mã nguồn** theo GPL-3.0. Nếu đổi tên hoặc thương hiệu, vẫn phải giữ ghi chú bản quyền gốc của ChurchApps. VDO.Ninja là dịch vụ bên thứ ba (mã nguồn mở, AGPL-3.0); app chỉ mở trang của dịch vụ này, không đóng gói mã của nó.

---

## 9. Ghi công

- **FreeShow** © ChurchApps, GPL-3.0: https://github.com/ChurchApps/FreeShow. Haidangshow giữ nguyên giấy phép GPL-3.0 và file `LICENSE`.
- **VDO.Ninja SDK** v1.6.2 © Steve Seguin, MPL-2.0: `public/vendor/vdoninja/` (không chỉnh sửa, kèm giấy phép). Haidangshow không liên kết hay được VDO.Ninja bảo trợ.
- Haidangshow **tắt** tự cập nhật về FreeShow gốc và tắt gửi báo cáo lỗi (Sentry) về dự án gốc.
