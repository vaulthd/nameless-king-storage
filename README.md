# FileShareWorker

A simple filesharing endpoint that uses Cloudflare's R2, Workers and Turnstile to serve up large files.

## Setup
Press this fancy button:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/socksthewolf/FileShareWorker)

You will need to update your routes and turnstile keys later.

Or:

1. Create an R2 Bucket
2. Create a turnstile widget. Set your site private key as a secret called `CAPTCHA_PRIV_KEY` via Wrangler
3. Update the toml files with your various settings and endpoints
4. Deploy to Cloudflare

## Usage

### Uploading

You can upload your files directly via wrangler or via the web dashboard on the management portal for your bucket. This has a limit of 300MB upload.
To upload bigger files, you can download and install [rclone](https://rclone.org/install/). Follow [the instructions on this page](https://developers.cloudflare.com/r2/examples/rclone/) to set up your rclone for CloudFlare.

For ease of use and to lower your potential chance of blowing out your limits early, make sure to also add the following lines in your config:

```text
no_check_bucket=true
max_upload_parts=100
chunk_size=100Mi
```

### Downloading

Your files will be accessible via your website + FILES_PATH + file name. Anything that doesn't exist will serve up a failure page.
