# Complete Guide: Hosting Node.js Applications on AWS EC2

This document explains the concepts, commands, and best practices for deploying and running a web application on an Amazon Web Services (AWS) EC2 instance. Use this as a reference guide for hosting this signaling server or any future Node.js systems.

---

## 1. Core AWS Concepts

Before running commands, it's essential to understand the basic AWS building blocks used in hosting:

* **EC2 (Elastic Compute Cloud)**: A virtual computer (instance) in the cloud. You have full root/administrator access to this system.
* **AMI (Amazon Machine Image)**: The operating system template for your instance (e.g., Ubuntu Server 24.04, Amazon Linux 2023). different AMIs have different default usernames:
  * Ubuntu: `ubuntu`
  * Amazon Linux: `ec2-user`
  * Debian: `admin`
* **Security Groups**: A virtual firewall that controls inbound and outbound traffic to your instance. By default, only SSH (port 22) is open. You must explicitly open other ports (like 80, 443, or 3000) in the AWS Console.
* **Key Pair (`.pem` file)**: A private key file used to log into the instance securely instead of using a password. **Never share this key or upload it to a public repository.**

---

## 2. Setting Up SSH Key Permissions

For security reasons, SSH clients reject private key files (`.pem`) that are "too open" (i.e., readable by other users on your machine).

### On Windows (PowerShell)
To strip inherited permissions and grant read access exclusively to your active Windows account, run:
```powershell
# Disable inheritance on the file
icacls aws/share2.me.pem /inheritance:r

# Grant read permissions to the current active user
icacls aws/share2.me.pem /grant:r "${env:USERNAME}:(R)"
```

### On Linux or macOS (Terminal)
To set read-only permissions for the file owner, run:
```bash
chmod 400 aws/share2.me.pem
```

---

## 3. SSH: Connecting to the Instance

SSH (Secure Shell) creates an encrypted terminal connection to your remote server.

### Command Structure
```bash
ssh -i <path-to-pem> -o StrictHostKeyChecking=no <username>@<public-ip-or-dns>
```

### Explanation of Arguments:
* `-i aws/share2.me.pem`: Specifies the private key identity file to use.
* `-o StrictHostKeyChecking=no`: Optional. Skips the interactive "Are you sure you want to connect?" prompt. Useful for automation or first-time connections.
* `ec2-user@52.66.196.70`: Logs in as the user `ec2-user` at the target IP address.

---

## 4. SCP: Copying Code Files to the Instance

SCP (Secure Copy Protocol) securely copies files or directories between your local computer and your remote instance using the same SSH key credentials.

### Copying a Single File
```bash
scp -i <path-to-pem> <local-file> <username>@<public-ip>:~/<remote-destination>
```

### Copying a Directory Recursively
Use the `-r` flag to copy a folder and all its contents:
```bash
scp -i aws/share2.me.pem -o StrictHostKeyChecking=no -r ./backend/* ec2-user@52.66.196.70:~/shareit-backend/
```

---

## 5. Installing Node.js & NPM via NVM

Instead of installing Node.js directly from the package manager (which is often outdated), it is best practice to use **NVM (Node Version Manager)**. NVM lets you install, update, and switch between different versions of Node.js on the fly.

### Step 1: Install NVM on the Server
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

### Step 2: Load NVM into the Session
Add NVM to your active terminal path (or close and re-open the terminal):
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### Step 3: Install Node.js LTS (Long Term Support)
```bash
nvm install --lts
```
*Verify installation with `node -v` and `npm -v`.*

---

## 6. PM2: Managing Production Processes

If you run a Node app with `node server.js`, the process terminates as soon as you close your SSH terminal window. **PM2 (Process Manager 2)** runs your applications in the background (as a daemon) and restarts them automatically if the app crashes or the server reboots.

### Install PM2 Globally
```bash
npm install -g pm2
```

### PM2 Command Cheat Sheet
* **Start an App**: Starts your server under a friendly alias.
  ```bash
  pm2 start server.js --name "my-app-name"
  ```
* **View Status**: Displays CPU, Memory, and Uptime of active processes.
  ```bash
  pm2 status
  ```
* **Restart an App**: Reloads the code.
  ```bash
  pm2 restart my-app-name
  ```
* **Stop an App**: Pauses the process.
  ```bash
  pm2 stop my-app-name
  ```
* **View Logs**: Prints real-time `stdout` and `stderr` logs.
  ```bash
  pm2 logs my-app-name
  ```
* **Save Process List**: Saves the currently running apps so they reload if the EC2 instance restarts.
  ```bash
  pm2 save
  ```
* **Generate Startup Script**: Tells the OS system manager to boot PM2 on system startup.
  ```bash
  pm2 startup
  ```

---

## 7. Serving over HTTPS using Caddy

To connect a secure frontend (like Vercel over `https://`) to your backend, your backend must also be served over HTTPS. **Caddy** is a web server that automatically provisions and renews SSL certificates from Let's Encrypt / ZeroSSL and forwards traffic to your Node port (reverse proxying).

### How Caddy Works:
1. When a client visits `https://api.yourdomain.com`, they connect to Caddy on port 443 (HTTPS).
2. Caddy negotiates the secure SSL handshake.
3. Caddy forwards the request to your Node.js application running locally on port 3000 (`localhost:3000`).

### Step 1: Create a Caddyfile
Create a configuration file at `/etc/caddy/Caddyfile`:
```caddy
api.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Step 2: Running Caddy as a Systemd Service
Create a service file at `/etc/systemd/system/caddy.service` so Caddy runs persistently:
```ini
[Unit]
Description=Caddy Web Server
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=exec
User=root
Group=root
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
```

### Step 3: Manage the Caddy Service
```bash
# Reload the system daemon configuration
sudo systemctl daemon-reload

# Start Caddy and configure it to run on boot
sudo systemctl enable --now caddy

# View logs to debug SSL/DNS issues
sudo journalctl -u caddy -f
```

---

## 8. Complete Step-by-Step Deployment Walkthrough

Here is the exact order of steps to deploy a fresh Node.js backend to AWS:

1. **Launch Instance**: Create an EC2 Instance (Ubuntu or Amazon Linux).
2. **Configure Security Groups**: Open port `22` (SSH) to your IP, and ports `80` (HTTP), `443` (HTTPS), and your application port (e.g. `3000`) to `0.0.0.0/0`.
3. **Configure DNS**: Point a subdomain (like `api.yourdomain.com`) to your EC2 instance's Public IPv4 address using an `A` record.
4. **Fix PEM Permissions**: Configure read permissions on your private key locally.
5. **Copy Code**: Use `scp` to send your code folder to the server.
6. **Connect via SSH**: Log into the instance.
7. **Install Node.js**: Download NVM and install the Node LTS version.
8. **Install Dependencies & Start PM2**:
   ```bash
   cd ~/your-app-folder
   npm install
   pm2 start server.js --name "app"
   pm2 save
   ```
9. **Configure Caddy**: Download the Caddy binary, configure the Caddyfile with your subdomain, set up the systemd service, and start it.
10. **Done**: Visit `https://api.yourdomain.com/health` to confirm the secure connection.
