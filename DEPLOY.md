# BOS — Debian সার্ভারে ডিপ্লয় গাইড

এই গাইড **Debian 12 (bookworm)** বা **Debian 13 (trixie)**-এর জন্য।
একটি স্ক্রিপ্টেই পুরো সেটআপ হয়ে যায়: Nginx, PHP-FPM, PostgreSQL, Composer, Node.js, ডাটাবেস, `.env`, বিল্ড এবং ওয়েব সার্ভার কনফিগ।

> স্ক্রিপ্টটি একটি পরিষ্কার Debian 12 সিস্টেমে চালিয়ে যাচাই করা হয়েছে (PHP 8.2, Node 18, PostgreSQL 15)।

---

## ০. যা লাগবে

- একটি Debian সার্ভার (কমপক্ষে **1 GB RAM**, 2 GB হলে ভালো — ফ্রন্টএন্ড বিল্ডে মেমোরি লাগে)
- `root` বা `sudo` অ্যাক্সেস
- একটি ডোমেইন/সাবডোমেইন (যেমন `bos.example.com`) যার **A রেকর্ড** সার্ভারের IP-তে সেট করা
  (শুধু IP দিয়ে পরীক্ষা করতে চাইলে `--domain`-এ সার্ভারের IP দিন, HTTPS ছাড়া চলবে)
- ফায়ারওয়াল থাকলে পোর্ট **80** ও **443** খোলা

---

## ১. প্রথমবার ইনস্টল

সার্ভারে লগইন করে:

```bash
sudo apt-get update && sudo apt-get install -y git
```

```bash
git clone https://github.com/hellosifat-dev/Bos.git /tmp/bos-setup
```

HTTPS সহ (ডোমেইন সার্ভারে পয়েন্ট করা থাকলে):

```bash
sudo bash /tmp/bos-setup/deploy/install-debian.sh --domain bos.example.com --email you@example.com
```

শুধু HTTP (পরীক্ষার জন্য / IP দিয়ে):

```bash
sudo bash /tmp/bos-setup/deploy/install-debian.sh --domain 203.0.113.10
```

স্ক্রিপ্ট যা করে:

1. প্যাকেজ ইনস্টল — nginx, php-fpm (+pgsql, mbstring, xml, curl, zip, bcmath, intl), postgresql, composer, nodejs, npm
2. কোড ক্লোন করে `/var/www/bos`-এ (`main` ব্রাঞ্চ)
3. PostgreSQL-এ `bos` ডাটাবেস ও ইউজার তৈরি করে (র‍্যান্ডম পাসওয়ার্ড)
4. `backend/.env` লেখে (`APP_ENV=production`, `APP_DEBUG=false`, ডাটাবেস তথ্য)
5. `deploy/update.sh` চালায় — composer install, key generate, migrate, seed, cache, ফ্রন্টএন্ড বিল্ড
6. Nginx সাইট কনফিগ করে (ফ্রন্টএন্ড `/`-এ, API `/api`-তে, একই ডোমেইনে)
7. `--email` দিলে Let's Encrypt দিয়ে HTTPS সেট করে

স্ক্রিপ্ট আবার চালানো নিরাপদ — আগের ডাটাবেস, `.env` আর কোড রেখে দেয়।

---

## ২. প্রথম লগইন অ্যাকাউন্ট তৈরি

ইমেইল সেটআপ না থাকলেও এই কমান্ডে সরাসরি একটি যাচাইকৃত মালিক অ্যাকাউন্ট তৈরি হয়:

```bash
cd /var/www/bos/backend && sudo -u www-data php artisan bos:create-owner you@example.com "Your Name"
```

পাসওয়ার্ড স্ক্রিনে দেখাবে (নিজে দিতে চাইলে `--password=...` যোগ করুন)।
তারপর ব্রাউজারে `https://bos.example.com` খুলে লগইন → **Businesses → New Business** দিয়ে ব্যবসা তৈরি করুন।

---

## ৩. ইমেইল সেটআপ (জরুরি)

নতুন ইউজার রেজিস্ট্রেশনে OTP কোড আর পাসওয়ার্ড রিসেট লিংক ইমেইলে যায়।
ডিফল্টে `MAIL_MAILER=log` — অর্থাৎ ইমেইল যায় না, শুধু লগে লেখা হয়।

`/var/www/bos/backend/.env` এডিট করুন (উদাহরণ: Gmail App Password বা Brevo/Mailgun SMTP):

```
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="you@gmail.com"
MAIL_FROM_NAME="BOS"
```

তারপর কনফিগ রিফ্রেশ:

```bash
sudo bash /var/www/bos/deploy/update.sh --no-pull
```

---

## ৪. নতুন আপডেট ডিপ্লয় করা

GitHub-এর `main`-এ নতুন কমিট এলে:

```bash
sudo bash /var/www/bos/deploy/update.sh
```

এটি `git pull` → dependencies → migrate → cache → ফ্রন্টএন্ড বিল্ড করে। আপডেটের সময় সাইট কয়েক সেকেন্ড maintenance mode-এ থাকে।

---

## Docker / প্ল্যাটফর্ম (Sifat.cloud ইত্যাদি) — সবচেয়ে সহজ

repo-র মূল ফোল্ডারে একটি **`Dockerfile`** আছে। এটি একটি কন্টেইনারেই ফ্রন্টএন্ড (React) আর ব্যাকএন্ড (Laravel API) দুটো চালায়।
প্ল্যাটফর্মে বিল্ড টাইপ **Dockerfile / Docker** দিন (Static বা Node নয়) — না হলে শুধু ফ্রন্টএন্ড স্ট্যাটিক সাইট হিসেবে চলবে, লগইন কাজ করবে না।

**প্রয়োজনীয় Environment Variable:**

| Variable | উদাহরণ | মন্তব্য |
|---|---|---|
| `DATABASE_URL` | `pgsql://user:pass@host:5432/bos` | PostgreSQL ডাটাবেস (অথবা `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` আলাদা করে) |
| `APP_KEY` | `base64:...` | **একবার তৈরি করে স্থায়ীভাবে রাখুন:** `echo "base64:$(openssl rand -base64 32)"` |
| `APP_URL` | `https://bos.apps.sifat.cloud` | সাইটের আসল ঠিকানা |
| `BOS_OWNER_EMAIL` / `BOS_OWNER_PASSWORD` | | প্রথম লগইন অ্যাকাউন্ট (উপরের অংশ দেখুন) |
| `BOS_REQUIRE_EMAIL_VERIFICATION` | `false` | ঐচ্ছিক, ইমেইল সেটআপের আগে |
| `PORT` | `8080` | কন্টেইনার এই পোর্টে শোনে (প্ল্যাটফর্ম সাধারণত নিজে দেয়) |

কন্টেইনার চালু হলে নিজেই ডাটাবেসের জন্য অপেক্ষা করে, migrate, seed আর মালিক অ্যাকাউন্ট তৈরি করে। হেলথ চেক: `/up`।
লগ প্ল্যাটফর্মের কন্টেইনার লগেই দেখা যায় (`LOG_CHANNEL=stderr`)।

নিজের মেশিনে পরীক্ষা:

```bash
docker build -t bos .
```

```bash
docker run -p 8080:8080 -e DATABASE_URL="pgsql://bos:pass@host.docker.internal:5432/bos" -e APP_KEY="base64:..." -e BOS_OWNER_EMAIL=you@example.com -e BOS_OWNER_PASSWORD=MyStrongPass123 bos
```

---

## প্ল্যাটফর্মে ডিপ্লয় (শেল ছাড়া, শুধু Environment Variable দিয়ে)

Sifat.cloud বা এমন যেকোনো প্ল্যাটফর্মে, যেখানে GitHub repo সিলেক্ট করে ডিপ্লয় হয় আর
Environment Variable সেট করা যায়, সেখানে প্রথম লগইনের জন্য কোনো কমান্ড চালাতে হয় না।

**১. Backend-এর Environment Variable-এ যোগ করুন:**

| Variable | মান | কাজ |
|---|---|---|
| `BOS_OWNER_EMAIL` | `you@example.com` | প্রথম মালিকের ইমেইল |
| `BOS_OWNER_PASSWORD` | শক্ত একটি পাসওয়ার্ড | ওই অ্যাকাউন্টের পাসওয়ার্ড |
| `BOS_OWNER_NAME` | `Your Name` | (ঐচ্ছিক) নাম |
| `BOS_REQUIRE_EMAIL_VERIFICATION` | `false` | (ঐচ্ছিক) ইমেইল সেটআপ না থাকা পর্যন্ত নতুন রেজিস্ট্রেশন সাথে সাথে চালু হবে, OTP কোড লাগবে না |

**২. রিডিপ্লয় করুন, তারপর সাইটে ওই ইমেইল-পাসওয়ার্ড দিয়ে লগইন করুন।**
প্রথম লগইনের সময় অ্যাপ নিজেই রোল/পারমিশন সিড করে আর মালিক অ্যাকাউন্ট তৈরি করে
(প্ল্যাটফর্ম `db:seed` না চালালেও)।

- অ্যাকাউন্ট একবার তৈরি হলে পরে `BOS_OWNER_PASSWORD` বদলালেও পুরনো পাসওয়ার্ড বদলায় না।
  লগইনের পর চাইলে Variable দুটো মুছে দিতে পারেন।
- ডাটাবেস টেবিলের জন্য প্ল্যাটফর্মকে প্রতিটি ডিপ্লয়ে `php artisan migrate --force` চালাতে হবে।
  প্ল্যাটফর্মে release/start কমান্ড দেওয়া গেলে শুধু এটি দিন — migrate, seed আর মালিক তৈরি একসাথে করে:

```bash
php artisan bos:setup
```

- ইমেইল (SMTP) সেটআপ হয়ে গেলে `BOS_REQUIRE_EMAIL_VERIFICATION` আবার `true` করে দিন।

---

## ৫. দরকারি তথ্য

| বিষয় | কোথায় |
|---|---|
| কোড | `/var/www/bos` |
| Backend কনফিগ | `/var/www/bos/backend/.env` |
| অ্যাপ লগ | `/var/www/bos/backend/storage/logs/laravel.log` |
| Nginx কনফিগ | `/etc/nginx/sites-available/bos.conf` |
| Nginx লগ | `/var/log/nginx/error.log` |
| হেলথ চেক | `https://bos.example.com/up` (200 মানে ঠিক আছে) |

**ব্যাকআপ (অবশ্যই চালু রাখুন):**

```bash
sudo -u postgres pg_dump bos | gzip > /root/bos-$(date +%F).sql.gz
```

প্রতিদিন স্বয়ংক্রিয় ব্যাকআপের জন্য `sudo crontab -e`-তে যোগ করুন:

```
0 2 * * * sudo -u postgres pg_dump bos | gzip > /root/bos-$(date +\%F).sql.gz
```

**সাপ্তাহিক ছুটি:** বেতনের হিসাবে ডিফল্ট শনি-রবি। বাংলাদেশের জন্য শুক্রবার করতে:

```bash
cd /var/www/bos/backend && sudo -u www-data php artisan tinker --execute="App\Models\Business::query()->each(fn(\$b) => \$b->update(['settings' => array_merge(\$b->settings ?? [], ['weekend_days' => [5]])]));"
```

---

## ৬. সমস্যা হলে

| লক্ষণ | সমাধান |
|---|---|
| `502 Bad Gateway` | PHP-FPM চালু নেই: `sudo systemctl restart php8.2-fpm` (Debian 13-এ `php8.4-fpm`) |
| `500` এরর | `tail -50 /var/www/bos/backend/storage/logs/laravel.log` দেখুন |
| পেজ রিফ্রেশে 404 | Nginx কনফিগ লোড হয়নি: `sudo nginx -t && sudo systemctl reload nginx` |
| লগইনের পর ফাঁকা / বারবার লগইন পেজ | ব্রাউজারের cache/localStorage মুছে আবার চেষ্টা করুন |
| রেজিস্ট্রেশনের কোড আসে না | ইমেইল সেটআপ করা হয়নি (ধাপ ৩), বা `bos:create-owner` ব্যবহার করুন |
| certbot ব্যর্থ | ডোমেইনের DNS সার্ভারে পয়েন্ট করছে কিনা দেখুন, তারপর `sudo certbot --nginx -d bos.example.com` |
| `npm run build`-এ মেমোরি শেষ | ২ GB swap যোগ করুন: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

কোথাও আটকে গেলে এরর মেসেজ আর `laravel.log`-এর শেষ অংশ পাঠান।
