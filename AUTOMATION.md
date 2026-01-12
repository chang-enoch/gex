# Market Data Automation

This document describes the automated market data fetching and uploading system.

## Overview

The system uses GitHub Actions to automatically fetch and upload market data for all tickers in your watchlist at market close (4:00 PM ET) every weekday.

## How It Works

### Schedule

- **Frequency**: Every weekday (Monday-Friday)
- **Time**: 4:00 PM EST (20:00 UTC)
- **Cron Expression**: `0 20 * * 1-5`

### Workflow Components

1. **Workflow File**: `.github/workflows/fetch-market-data.yml`

   - Triggers on schedule or manual dispatch
   - Sets up Python environment
   - Installs dependencies
   - Runs the fetch job
   - Uploads logs on failure

2. **Fetch Job Script**: `scripts/fetch_market_data_job.py`

   - Wrapper that runs the actual fetch
   - Handles logging to file and console
   - Validates environment variables
   - Provides detailed error reporting
   - Logs stored in `logs/` directory

3. **Data Fetch Script**: `scripts/fetch_data.py`
   - Fetches all watchlist tickers
   - Calculates GEX metrics
   - Uploads to Supabase

## Setup Instructions

### 1. Add Repository Secrets

GitHub Actions needs your Supabase credentials. Add these secrets to your repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

**Important**: These are sensitive credentials. Never commit `.env.local` to GitHub.

### 2. Configure Workflow Schedule

The workflow is configured to run at 4:00 PM EST. To change the schedule:

1. Edit `.github/workflows/fetch-market-data.yml`
2. Modify the `cron` value under `on.schedule`
3. Commit and push changes

**Cron Format**: `minute hour day month day-of-week`

- `0 20 * * 1-5` = 8:00 PM UTC, Monday-Friday (= 4:00 PM EST)
- `0 21 * * 1-5` = 9:00 PM UTC, Monday-Friday (= 5:00 PM EST)

### 3. Manual Trigger

You can also manually trigger the workflow:

1. Go to **Actions** tab in your GitHub repository
2. Click **Fetch Market Data at Close**
3. Click **Run workflow**

## Monitoring

### View Logs

1. Go to **Actions** tab
2. Click on the latest **Fetch Market Data at Close** run
3. Click on **fetch-and-upload** job
4. View real-time logs

### Check Status

- ✅ Green checkmark = Successful run
- ❌ Red X = Failed run
- ⏳ Yellow dot = Currently running

### Failure Notifications

- Failed runs will upload logs as artifacts (available for 7 days)
- Configure email/Slack notifications in GitHub settings if desired

## Troubleshooting

### Workflow Doesn't Run

1. **Check if Actions are enabled**: Settings → Actions → General
2. **Verify cron syntax**: Use [crontab.guru](https://crontab.guru)
3. **Check secrets are set**: Settings → Secrets and variables → Actions

### Fetch Fails

1. **Check API credentials**: Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. **Review logs**: Go to Actions and view the failed run's logs
3. **Test locally**: Run `python scripts/fetch_data.py` in your environment

### Watchlist Empty

If no tickers are in your watchlist:

1. Visit your app
2. Add tickers to the watchlist
3. They'll be included in the next scheduled fetch

## Environment Variables

Required environment variables (configured via GitHub Secrets):

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Advanced Configuration

### Change Time Zone

The cron uses UTC. Common times:

- **3:00 PM EST**: `0 20 * * 1-5` (current)
- **4:00 PM EST**: `0 21 * * 1-5`
- **5:00 PM EST**: `0 22 * * 1-5`
- **Market open (9:30 AM EST)**: `0 14 * * 1-5`

### Run on Specific Days

To run only on certain days:

- Monday only: `0 20 * * 1`
- Monday-Thursday: `0 20 * * 1-4`
- Monday, Wednesday, Friday: `0 20 * * 1,3,5`

### Run Multiple Times Per Day

To run both at market open and close:

```yaml
on:
  schedule:
    - cron: "0 14 * * 1-5" # Market open
    - cron: "0 21 * * 1-5" # Market close
```

## Security Best Practices

1. **Never commit credentials** to your repository
2. **Use repository secrets** for sensitive values
3. **Restrict Actions permissions** if needed: Settings → Actions → General
4. **Review logs carefully** for any exposed data
5. **Rotate keys periodically**

## Support

For issues:

1. Check GitHub Actions logs
2. Review the fetch script output
3. Verify Supabase connectivity
4. Check your watchlist has tickers
