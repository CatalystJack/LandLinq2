# Duplicate Deal Investigation Guide

## Problem
1600 Camden deal is being automatically created every ~3 hours on production site.

## Possible External Causes

### 1. SendGrid Test/Monitoring
- **Check**: SendGrid dashboard → Inbound Parse → Test console
- **Issue**: If you have a test email saved in SendGrid's test tool, it may be auto-resending
- **Fix**: Clear any saved test emails in SendGrid console

### 2. External Monitoring Service
- **Check**: Do you have UptimeRobot, Pingdom, or similar monitoring the `/api/email/inbound` endpoint?
- **Issue**: Some monitoring tools POST test data to webhooks
- **Fix**: Disable or reconfigure the monitoring for email webhook

### 3. Twilio SMS Retry
- **Check**: Twilio console → Messaging → Webhooks → Failed requests
- **Issue**: Twilio retries failed webhook deliveries every few hours
- **Fix**: Clear failed webhook queue in Twilio

### 4. Scheduled Email Forward
- **Check**: Email forwarding rules or filters
- **Issue**: Email client might have a rule auto-forwarding emails to deals@catalyst.landlinq.ai
- **Fix**: Check Gmail/Outlook filters and forwarding rules

### 5. API Integration
- **Check**: Third-party services integrated with your system
- **Issue**: CRM, property listing service, or automation tool sending data
- **Fix**: Check Zapier, Make.com, or other integration tools

## How to Identify the Source

### Step 1: Check Production Logs
Look for the POST request to `/api/email/inbound` or `/api/sms/inbound` when the duplicate is created.
Check the `User-Agent` header - this will tell you what's making the request.

### Step 2: Add Enhanced Logging
I can add detailed logging that captures:
- Source IP address
- User-Agent
- Full webhook payload
- Timestamp pattern analysis

Would you like me to add this enhanced logging to help identify the source?

### Step 3: Temporary Solution
Block the duplicate at the source once identified, or I can add IP-based blocking if needed.

## Questions to Help Debug
1. Do you have any monitoring services set up (UptimeRobot, Pingdom, etc.)?
2. Are there any email forwarding rules in place?
3. Do you have any Zapier/Make.com automations configured?
4. When did this start happening? (Helps identify what changed)
5. Is it always the exact same deal (1600 Camden) or does it vary?
