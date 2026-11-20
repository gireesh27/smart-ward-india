# Deployment

Short answer: **yes, a pilot can run for free** on an Oracle Cloud *Always Free* virtual machine in
India. For production, use **Azure Central India** or **AWS Mumbai** (both MeitY-empanelled clouds).
Avoid Vercel's free Hobby plan: its terms restrict it to non-commercial personal use, and it does not
host PostgreSQL.

| Option | Cost | Good for | Notes (checked November 2026) |
|---|---|---|---|
| Your laptop (Docker Compose) | Free | Development, demos | README steps 1–6 |
| **Oracle Cloud Always Free**, Hyderabad | **Free** | Pilot / demo for a district | Always Free Arm allowance is **2 OCPU + 12 GB RAM** (older guides still say 4/24), 200 GB disk. Idle VMs (under 20% use for 7 days) can be reclaimed. |
| Azure (Central India / South India) | About US$80–200/month for production (estimate) | Production | 12 months free PostgreSQL Flexible Server B1MS (750 h, 32 GB) and a monthly Container Apps grant (180,000 vCPU-s, 360,000 GiB-s, 2M requests) for new accounts |
| AWS (Mumbai / Hyderabad) | Similar (estimate) | Production | Accounts created after 15 July 2025 get up to US$200 of credits on a **6-month** free plan, not 12 months |

Run your own price check in the Azure or AWS pricing calculator before committing; the monthly figures
above are estimates for one app container, a 2-vCore database and 50 GB of storage.

---

## 0. Before you start (all options)

1. Put the project in GitHub (private repository is fine). **Keep the working copy outside OneDrive**
   (for example `C:\dev\smart-ward-india`): OneDrive locks files in `node_modules` and `.next`.
2. The CI workflow (`.github/workflows/deploy.yml`) builds two images on every push to `main` and pushes
   them to GitHub Container Registry, for both Arm (Oracle) and Intel (Azure/AWS):
   `ghcr.io/<you>/smart-ward-india:latest` (the website) and `:latest-tools` (migrations, LGD import).
   Your laptop never needs to pull from Docker Hub.
3. Buy or choose a domain (or a free subdomain) for HTTPS.
4. **Commit `package-lock.json` and the `prisma/migrations` folder.** Both are created on your machine
   (`npm install`, `npx prisma migrate dev`). CI installs exactly the locked versions, and the server applies
   the migrations on start with `prisma migrate deploy`. If an image has no migrations, the start script
   (`scripts/docker/start.sh`) creates the tables with `prisma db push` instead; that refuses any change
   that would delete data, but committed migrations are the right setup for production.

## 1. Free pilot on Oracle Cloud Always Free (step by step)

1. Sign up at cloud.oracle.com and choose **India South (Hyderabad)** as the home region (it cannot be
   changed later, and free Arm capacity is easier to get there than in Mumbai).
2. Create a VM: **Compute → Instances → Create**. Image *Ubuntu 24.04 (aarch64)*, shape
   *VM.Standard.A1.Flex* with **2 OCPU / 12 GB**, boot volume 100 GB, add your SSH public key.
3. Open ports 80 and 443: in the VCN's security list add ingress rules for TCP 80/443 from 0.0.0.0/0,
   then on the VM: `sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT && sudo netfilter-persistent save`.
4. Point your domain's **A record** at the VM's public IP.
5. Install Docker on the VM:
   ```bash
   curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker ubuntu && newgrp docker
   ```
6. Get the deployment files and configure:
   ```bash
   sudo mkdir -p /opt/smartward && sudo chown ubuntu /opt/smartward && cd /opt/smartward
   git clone https://github.com/<you>/smart-ward-india.git .
   cp deploy/.env.production.example deploy/.env.production && nano deploy/.env.production
   ```
   Set `DOMAIN`, `APP_IMAGE`, `TOOLS_IMAGE`, a long `POSTGRES_PASSWORD` (also inside `DATABASE_URL`),
   `BETTER_AUTH_SECRET` (`openssl rand -base64 48`), `APP_URL`/`BETTER_AUTH_URL` (https://your-domain) and SMTP details.
   If the repository is private, log in to the registry first: `echo <token> | docker login ghcr.io -u <you> --password-stdin`.
7. Start the stack (Postgres, app, Caddy with automatic HTTPS):
   ```bash
   docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d
   ```
   On start the app brings the database schema up to date (see step 0.4), then serves on port 3000.
8. Load the real geography (once, about a minute):
   ```bash
   docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production --profile tools run --rm tools npm run lgd:import
   ```
9. Create the first super administrator:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production --profile tools run --rm tools npm run admin:create
   ```
10. Open https://your-domain and check https://your-domain/api/health returns `{"status":"ok"}`.
11. Backups: `crontab -e` and add `0 2 * * * /opt/smartward/deploy/backup.sh` (14 days kept in `deploy/backups/`).
    Copy them off the VM regularly (Oracle Object Storage has a free 20 GB tier).
12. Automatic deploys: in GitHub → Settings → Secrets and variables → Actions, add variable `DEPLOY_HOST`
    (VM IP), optional `DEPLOY_USER`, and secret `DEPLOY_SSH_KEY`. Every push to `main` then rebuilds and restarts the app.

Optional: AI insights on this VM with Ollama and a small model (3–4B, quantised) work for occasional
analyses but are slow on 2 Arm cores; or set `AI_PROVIDER=none`.

## 2. Production on Azure (Central India)

1. Resource group in **Central India**: `az group create -n smartward -l centralindia`.
2. Database: `az postgres flexible-server create -g smartward -n smartward-db --tier Burstable --sku-name Standard_B1ms --version 16 --storage-size 32 --admin-user smartward --admin-password <secret> --public-access None` (General Purpose 2 vCores for production).
3. Storage for photos/videos: a Storage account with a private container; set `STORAGE_DRIVER=s3` only if you put an S3-compatible gateway in front, otherwise keep local storage on an Azure Files volume mounted at `/app/storage/uploads`.
4. Email: Azure Communication Services Email (choose **India** as the data location) or another SMTP provider.
5. App: Azure Container Apps environment (consumption plan), app from `ghcr.io/<you>/smart-ward-india:latest`, min replicas 1, ingress port 3000, environment variables as in `deploy/.env.production.example` (secrets in Key Vault references).
6. LGD import: run the `:latest-tools` image once as a Container Apps **job** with command `npm run lgd:import`.
7. Custom domain + managed certificate in the Container App; Application Insights for logs.

## 3. Production on AWS (Mumbai)

1. RDS for PostgreSQL 16 in `ap-south-1` (db.t4g.small for a pilot, Multi-AZ for production), private subnets.
2. App: **ECS Fargate** service from the GHCR image (or Lightsail containers for the cheapest small setup) behind an Application Load Balancer with an ACM certificate.
3. Files: S3 bucket (private) with `STORAGE_DRIVER=s3`, `S3_REGION=ap-south-1`; CloudFront for public assets.
4. Email: Amazon SES (verify your domain).
5. LGD import: run the `:latest-tools` image as a one-off ECS task with command `npm run lgd:import`.
6. Secrets in AWS Secrets Manager; logs in CloudWatch; budgets and alerts in Billing.

## 4. Locally

See README steps 1–6. On a corporate laptop where Docker Hub is blocked, either use mirrors
(`public.ecr.aws/docker/library/postgres:16-alpine`) or install PostgreSQL 16 and Mailpit natively and point `DATABASE_URL` at them.

## Production checklist

- `NODE_ENV=production`, strong `BETTER_AUTH_SECRET`, `APP_URL` with https.
- Never run `npm run db:seed` against production (it refuses non-local databases anyway).
- Reverse proxy body limit ≥ `UPLOAD_MAX_VIDEO_BYTES` (Caddyfile allows 60 MB).
- Backups tested by restoring into a scratch database.
- Map tiles: the default OpenStreetMap tile server is for light use only; use your own tiles or a commercial provider for real traffic (`NEXT_PUBLIC_MAP_TILE_URL`).
- Privacy notice and DPDP obligations reviewed by the department's legal team.
