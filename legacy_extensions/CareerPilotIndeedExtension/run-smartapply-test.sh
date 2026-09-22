#!/bin/bash

# SmartApply Real-World Test Runner
# This script runs the Playwright test for Indeed SmartApply automation

# Set required environment variables
export CP_REAL_INDEED_TEST=1

# Set your profile directory (Chrome will save login session here)
export CP_INDEED_PROFILE_DIR="${HOME}/.indeed-test-profile"

# Optional: Customize search parameters
export CP_INDEED_SEARCH="${CP_INDEED_SEARCH:-developer}"
export CP_INDEED_LOCATION="${CP_INDEED_LOCATION:-Remote}"

# Optional: Run in headless mode (0 = visible browser, 1 = headless)
export CP_INDEED_HEADLESS="${CP_INDEED_HEADLESS:-0}"

echo "🚀 Starting Indeed SmartApply Real-World Test"
echo "================================"
echo "Search: $CP_INDEED_SEARCH"
echo "Location: $CP_INDEED_LOCATION"
echo "Profile Dir: $CP_INDEED_PROFILE_DIR"
echo "Headless: $CP_INDEED_HEADLESS"
echo "================================"
echo ""

# Navigate to test directory
cd "$(dirname "$0")/.."

# Run the test
npx playwright test tests/smartapply-real-world.spec.js --headed

echo ""
echo "✅ Test completed!"
echo ""
echo "📊 View detailed report with: npx playwright show-report"
