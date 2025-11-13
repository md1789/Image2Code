# ngrok Deployment Cheatsheet

Follow these steps each time you want to share the local app with classmates.

## 1. Start the dev server

```powershell
cd F:\Image2Code\my-react-router-app
npm run dev
```

Leave this PowerShell window running; it serves the site on `http://localhost:5173` by default.

## 2. (One-time) make sure ngrok knows your authtoken

Skip this if you already ran it and see `Authtoken saved to configuration file.` once.

```powershell
& "C:\Users\mdieh\AppData\Local\Microsoft\WindowsApps\ngrok.exe" config add-authtoken <YOUR_TOKEN>
```

## 3. Start the public tunnel

Open a second PowerShell window and run:

```powershell
& "C:\Users\mdieh\AppData\Local\Microsoft\WindowsApps\ngrok.exe" http 5173
```

ngrok will print a line that begins with `Forwarding`. Share the HTTPS URL shown there with others; they can access the app as long as both PowerShell windows stay open.

## 4. Restarting later

Whenever you stop and restart development, repeat steps 1 and 3 (step 2 is only needed if you delete your ngrok config).
