EKRON 對 HOKUTO 3D（網頁版）

上傳：把這個壓縮檔解開後，整個資料夾的內容（index.html、game.js、models、tex）
上傳到任何靜態網站空間即可，例如 GitHub Pages、Netlify、Cloudflare Pages 或自己的主機。
開啟網址就是 index.html，手機和電腦都能玩。

本機試玩：雙擊 start_server.bat（需要已安裝 Python），
手機在同一個 Wi-Fi 下打開視窗顯示的網址。

注意：
- 必須透過網址開啟（http/https），直接雙擊 index.html 用 file:// 開會無法載入模型。
- 需要能連網，因為 Three.js 是從 cdn.jsdelivr.net 載入。
- models/glb.js 是給不支援 .glb 檔的空間用的備援，可以一起上傳。

iPhone 8 等舊手機：iOS 需 15 以上（建議更新到 16.4 以上）。遊戲會自動降低畫質維持流暢。
