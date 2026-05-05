# Hotspot Setup Guide - BrainyGrasp Website

## 🌐 Access Your Website from Hotspot Connected Devices

### 📋 Your Network Information
- **Local IP Address**: `10.226.58.121`
- **Backend Port**: `3000`
- **Frontend Port**: `5501`
- **Subnet**: `10.226.58.0/255.255.255.0`

### 🔧 Step 1: Restart Your Backend Server

1. **Stop the current backend server** (if running)
   ```bash
   # Press Ctrl+C in the terminal where backend is running
   ```

2. **Start the backend server with the new configuration**
   ```bash
   cd c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\backend
   node server.js
   ```

   You should see:
   ```
   🚀 BrainyGrasp API running on http://localhost:3000
   🌐 Accessible from network devices at http://0.0.0.0:3000
   ```

### 🌐 Step 2: Start Your Frontend Server

1. **Open a new terminal** and start the frontend server
   ```bash
   cd c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\frontend
   npx serve -s . -l 5501
   ```

### 📱 Step 3: Connect Your Hotspot Device

1. **Enable hotspot on your computer**
   - Windows: Go to Settings > Network & Internet > Mobile hotspot
   - Turn on "Share my Internet connection with other devices"
   - Note the hotspot name and password

2. **Connect your mobile device** to the hotspot

### 🌍 Step 4: Access the Website from Mobile Device

1. **Open browser** on your mobile device
2. **Access the frontend** using:
   ```
   http://10.226.58.121:5501
   ```

3. **Test the backend API** (optional):
   ```
   http://10.226.58.121:3000/api/auth/status
   ```

### 🔍 Step 5: Verify Everything Works

1. **Test frontend loading**
   - You should see the BrainyGrasp homepage
   - All images and styles should load properly

2. **Test user authentication**
   - Try logging in with email: `vasanthvasanth4863@gmail.com`
   - Check if OTP verification works
   - Verify dashboard loads correctly

3. **Test add to cart functionality**
   - Add products to cart
   - Verify cart count updates
   - Check cart persistence

### 🛠️ Troubleshooting

#### If Frontend Doesn't Load:
1. **Check firewall settings**:
   - Windows Defender may block incoming connections
   - Go to Windows Security > Firewall & network protection
   - Allow Node.js/serve through firewall

2. **Check antivirus software**:
   - Temporarily disable antivirus to test
   - Add exceptions for Node.js and ports 3000/5501

3. **Verify server is running**:
   ```bash
   # Check if ports are listening
   netstat -an | findstr :3000
   netstat -an | findstr :5501
   ```

#### If Backend API Doesn't Work:
1. **Check CORS settings**:
   - The server is configured with `Access-Control-Allow-Origin: *`
   - Should work from any device on the network

2. **Test API directly**:
   ```bash
   # From your computer
   curl http://10.226.58.121:3000/api/auth/status
   
   # From mobile device browser
   http://10.226.58.121:3000/api/auth/status
   ```

#### If Connection Times Out:
1. **Check if both devices are on same network**
2. **Verify hotspot is working** (try browsing other websites)
3. **Restart both servers** and try again

### 📋 Quick Setup Commands

```bash
# Terminal 1: Backend Server
cd c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\backend
node server.js

# Terminal 2: Frontend Server  
cd c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\frontend
npx serve -s . -l 5501

# Mobile Device Browser:
http://10.226.58.121:5501
```

### 🎯 Success Indicators

✅ **Backend server shows both localhost and 0.0.0.0 messages**  
✅ **Frontend loads on mobile device**  
✅ **All images and styles display correctly**  
✅ **User authentication works**  
✅ **Add to cart functionality works**  
✅ **Profile management works**  

### 🔐 Security Notes

- **This setup is for development/testing only**
- **Not recommended for production use**
- **Anyone on your network can access the site**
- **Consider adding authentication for production**

### 📞 Need Help?

If you encounter issues:
1. Check both servers are running
2. Verify IP address: `10.226.58.121`
3. Ensure firewall allows connections
4. Test with different browsers
5. Check mobile device network connection

---

**Your BrainyGrasp website should now be accessible from any device connected to your hotspot!** 🚀
