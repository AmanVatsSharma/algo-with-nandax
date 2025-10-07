# ☁️ AWS EC2 Deployment Guide - Production Ready

## 🎯 Deployment Architecture

### **Production Setup:**

```
        Internet
           ↓
    Route 53 (DNS)
           ↓
    CloudFront (CDN)
           ↓
    ALB (Load Balancer)
           ↓
    ┌──────┴──────┐
    ↓             ↓
EC2 (API)    EC2 (Web)
    ↓             
RDS PostgreSQL
    ↓
ElastiCache Redis
```

---

## 📋 Pre-Deployment Checklist

### **1. AWS Account Setup**
- [ ] Create AWS account
- [ ] Set up billing alerts
- [ ] Create IAM users (don't use root)
- [ ] Enable MFA
- [ ] Create budget limits

### **2. Domain & SSL**
- [ ] Buy domain (GoDaddy/Namecheap/Route53)
- [ ] Point nameservers to Route 53
- [ ] Request SSL certificate (ACM)
- [ ] Verify SSL certificate

### **3. Environment Variables**
- [ ] Generate production JWT secrets
- [ ] Get Zerodha API credentials
- [ ] Prepare all `.env` values
- [ ] Store in AWS Systems Manager Parameter Store

---

## 🚀 Step-by-Step Deployment

### **Phase 1: Network Setup (30 mins)**

#### **1.1 Create VPC**
```bash
VPC Name: algo-nandax-vpc
CIDR: 10.0.0.0/16
Availability Zones: 2 (ap-south-1a, ap-south-1b)
```

#### **1.2 Create Subnets**
```bash
# Public Subnets (for EC2, ALB)
public-subnet-1a: 10.0.1.0/24
public-subnet-1b: 10.0.2.0/24

# Private Subnets (for RDS, Redis)
private-subnet-1a: 10.0.11.0/24
private-subnet-1b: 10.0.12.0/24
```

#### **1.3 Create Internet Gateway**
- Attach to VPC
- Update route tables

#### **1.4 Security Groups**

**ALB Security Group:**
```
Inbound:
- HTTP (80) from 0.0.0.0/0
- HTTPS (443) from 0.0.0.0/0
```

**EC2 Security Group:**
```
Inbound:
- 3000 (Web) from ALB SG
- 3001 (API) from ALB SG
- 22 (SSH) from your IP
```

**RDS Security Group:**
```
Inbound:
- 5432 from EC2 SG
```

**Redis Security Group:**
```
Inbound:
- 6379 from EC2 SG
```

---

### **Phase 2: Database Setup (45 mins)**

#### **2.1 Create RDS PostgreSQL**

```bash
Engine: PostgreSQL 16
Instance: db.t3.medium (start) → db.r6g.xlarge (scale)
Storage: 100GB General Purpose SSD (gp3)
Multi-AZ: Yes (production)
Backup: Automated, 7 days retention
```

**Configuration:**
```
DB Name: algo_trading
Username: postgres
Password: [Generate strong password]
VPC: algo-nandax-vpc
Subnet Group: private-subnets
Security Group: RDS SG
```

**Performance Tuning:**
```sql
-- Parameter Group Settings
shared_buffers = 2GB
max_connections = 200
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 10MB
```

#### **2.2 Create ElastiCache Redis**

```bash
Engine: Redis 7.x
Node Type: cache.t3.medium (start) → cache.r6g.large (scale)
Number of Replicas: 1 (Multi-AZ)
Subnet Group: private-subnets
Security Group: Redis SG
```

---

### **Phase 3: EC2 Instance Setup (1 hour)**

#### **3.1 Launch EC2 Instances**

**Instance Type Recommendations:**

**Starter (1K users):**
- API: t3.large (2 vCPU, 8GB RAM)
- Web: t3.medium (2 vCPU, 4GB RAM)

**Growth (10K users):**
- API: t3.xlarge (4 vCPU, 16GB RAM)
- Web: t3.large (2 vCPU, 8GB RAM)

**Scale (100K users):**
- API: c6i.2xlarge (8 vCPU, 16GB RAM)
- Web: t3.xlarge (4 vCPU, 16GB RAM)

**AMI:** Ubuntu Server 22.04 LTS

**Storage:** 50GB gp3 SSD

**Key Pair:** Create new or use existing

---

#### **3.2 Connect to EC2**

```bash
# Download .pem file
chmod 400 algo-nandax-key.pem

# Connect
ssh -i algo-nandax-key.pem ubuntu@<EC2-PUBLIC-IP>
```

---

#### **3.3 Install Dependencies**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git

# Install build tools
sudo apt install -y build-essential

# Install Nginx (for reverse proxy)
sudo apt install -y nginx

# Install certbot (for SSL)
sudo apt install -y certbot python3-certbot-nginx
```

---

#### **3.4 Clone and Setup Project**

```bash
# Clone repository
cd /home/ubuntu
git clone https://github.com/AmanVatsSharma/algo-with-nandax.git
cd algo-with-nandax

# Install dependencies
pnpm install

# Create environment files
nano apps/api/.env
# Paste production environment variables

nano apps/web/.env
# Paste frontend environment variables
```

---

#### **3.5 Environment Variables (Production)**

**apps/api/.env:**
```env
NODE_ENV=production
PORT=3001
API_PREFIX=api/v1

# Database (RDS endpoint)
DB_HOST=algo-nandax-db.xxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-secure-password
DB_DATABASE=algo_trading

# Redis (ElastiCache endpoint)
REDIS_HOST=algo-nandax-redis.xxxxx.cache.amazonaws.com
REDIS_PORT=6379

# JWT (Generate new secrets!)
JWT_SECRET=your-super-secure-32-char-secret-production-key
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-production
JWT_REFRESH_EXPIRATION=30d

# Zerodha Kite
KITE_API_KEY=your-kite-api-key
KITE_API_SECRET=your-kite-api-secret
KITE_REDIRECT_URL=https://yourdomain.com/auth/kite/callback

# Frontend
FRONTEND_URL=https://yourdomain.com
```

**apps/web/.env:**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_WS_URL=https://api.yourdomain.com
```

---

#### **3.6 Build Applications**

```bash
# Build API
pnpm build:api

# Build Web
pnpm build:web
```

---

#### **3.7 Run Database Migrations**

```bash
pnpm --filter @algo-nandax/api migration:run
```

---

#### **3.8 Start with PM2**

```bash
# Start API
pm2 start apps/api/dist/main.js --name "api" \
  -i max \
  --max-memory-restart 2G

# Start Web
cd apps/web
pm2 start npm --name "web" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

### **Phase 4: Nginx Setup (30 mins)**

#### **4.1 Configure Nginx**

**For API (api.yourdomain.com):**

```bash
sudo nano /etc/nginx/sites-available/api
```

```nginx
upstream api_backend {
    least_conn;
    server localhost:3001;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API requests
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

**For Web (yourdomain.com):**

```bash
sudo nano /etc/nginx/sites-available/web
```

```nginx
upstream web_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Next.js
    location / {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://web_backend;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

**Enable sites:**
```bash
sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/web /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

#### **4.2 Setup SSL with Let's Encrypt**

```bash
# Get SSL for API
sudo certbot --nginx -d api.yourdomain.com

# Get SSL for Web
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (test)
sudo certbot renew --dry-run
```

---

### **Phase 5: Monitoring & Logs (30 mins)**

#### **5.1 PM2 Monitoring**

```bash
# View logs
pm2 logs

# Monitor
pm2 monit

# View specific app logs
pm2 logs api
pm2 logs web
```

#### **5.2 Setup CloudWatch Logs**

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure CloudWatch
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

#### **5.3 Setup Alerts**

**CloudWatch Alarms:**
- CPU > 80% for 5 minutes
- Memory > 85%
- Disk > 80%
- 5xx errors > 10 in 5 minutes

---

## 🔧 Optimization & Security

### **1. Security Hardening**

```bash
# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Restart SSH
sudo systemctl restart sshd

# Install fail2ban
sudo apt install fail2ban -y
```

### **2. Database Optimization**

```sql
-- Create indexes
CREATE INDEX idx_trades_user_status ON trades(user_id, status);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_broker_connections_user ON broker_connections(user_id);

-- Enable pg_stat_statements
CREATE EXTENSION pg_stat_statements;

-- Regular VACUUM
VACUUM ANALYZE;
```

### **3. Redis Optimization**

```bash
# Set max memory policy
maxmemory-policy allkeys-lru

# Enable persistence
save 900 1
save 300 10
save 60 10000
```

---

## 📊 Auto-Scaling Setup

### **1. Create AMI**
- Stop EC2 instance
- Create AMI snapshot
- Use for auto-scaling

### **2. Launch Template**
- Create launch template with AMI
- User data script for auto-config

### **3. Auto Scaling Group**
```
Min: 1
Desired: 2
Max: 10

Scaling Policies:
- CPU > 70%: Add 1 instance
- CPU < 30%: Remove 1 instance
```

---

## 💰 Cost Optimization

### **Estimated Monthly Costs:**

**Starter Setup (1K users):**
- EC2 (2x t3.medium): $60
- RDS (db.t3.medium): $70
- Redis (cache.t3.medium): $45
- ALB: $20
- Data Transfer: $20
- Total: ~$215/month

**Growth Setup (10K users):**
- EC2 (2x t3.xlarge): $240
- RDS (db.r6g.large): $185
- Redis (cache.r6g.large): $120
- ALB: $20
- Data Transfer: $100
- Total: ~$665/month

**Scale Setup (100K users):**
- EC2 (5x c6i.xlarge): $750
- RDS (db.r6g.2xlarge): $740
- Redis (cache.r6g.xlarge): $240
- ALB: $50
- Data Transfer: $500
- CloudFront: $100
- Total: ~$2,380/month

---

## 🚀 Deployment Checklist

**Pre-Launch:**
- [ ] All services running
- [ ] SSL certificates valid
- [ ] Database migrations complete
- [ ] Environment variables set
- [ ] Monitoring configured
- [ ] Backups enabled
- [ ] Security groups configured
- [ ] Domain pointing correctly

**Launch Day:**
- [ ] Test all features
- [ ] Run load tests
- [ ] Monitor logs
- [ ] Have rollback plan
- [ ] Team on standby

**Post-Launch:**
- [ ] Monitor metrics
- [ ] Check error rates
- [ ] Verify performance
- [ ] User feedback
- [ ] Optimize based on usage

---

## 🔄 CI/CD Pipeline (Bonus)

### **GitHub Actions**

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_KEY }}
          script: |
            cd /home/ubuntu/algo-with-nandax
            git pull
            pnpm install
            pnpm build
            pm2 restart all
```

---

## 📝 Maintenance Tasks

### **Daily:**
- Check PM2 status
- Review error logs
- Monitor resource usage

### **Weekly:**
- Database backup verification
- Security updates
- Performance review
- Log rotation

### **Monthly:**
- Cost analysis
- Security audit
- Performance optimization
- Capacity planning

---

## 🆘 Troubleshooting

### **API Not Responding:**
```bash
pm2 logs api
pm2 restart api
```

### **Database Connection Failed:**
```bash
# Check security group
# Verify RDS endpoint
# Test connection
psql -h <RDS_ENDPOINT> -U postgres -d algo_trading
```

### **High Memory Usage:**
```bash
# Check PM2
pm2 monit

# Restart if needed
pm2 restart all
```

### **SSL Certificate Issues:**
```bash
# Renew certificate
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 🎯 Go Live Checklist

- [ ] Domain purchased and configured
- [ ] SSL certificates installed
- [ ] All environment variables set
- [ ] Database migrated and backed up
- [ ] PM2 processes running
- [ ] Nginx configured correctly
- [ ] Security groups configured
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Tested all critical features
- [ ] Load tested
- [ ] Have support plan ready

---

**You're Ready to Go Live! 🚀**

Remember: Start small, monitor everything, scale gradually!
