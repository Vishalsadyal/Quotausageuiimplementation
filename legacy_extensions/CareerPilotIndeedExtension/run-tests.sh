#!/bin/bash

# CareerPilot Indeed Extension - Test Runner
# This script makes it easy to run Playwright tests for the Indeed extension

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SEARCH_TERM="${CP_INDEED_SEARCH:-remote developer}"
LOCATION="${CP_INDEED_LOCATION:-United States}"
MAX_APPS="${CP_MAX_APPS:-1}"
HEADLESS="${CP_INDEED_HEADLESS:-0}"
PROFILE_DIR="${CP_INDEED_PROFILE_DIR:-$(pwd)/.test-profile}"

# Print header
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   CareerPilot Indeed Extension - Playwright Test Runner   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print usage
usage() {
    echo "Usage: $0 [test-type] [options]"
    echo ""
    echo "Test Types:"
    echo "  full         - Full SmartApply flow test (default)"
    echo "  dry          - Dry-run smoke test"
    echo "  smartapply   - Original SmartApply test"
    echo "  all          - Run all tests"
    echo ""
    echo "Options:"
    echo "  --search \"term\"     - Job search term (default: 'remote developer')"
    echo "  --location \"loc\"    - Location (default: 'United States')"
    echo "  --max-apps N       - Max applications (default: 1)"
    echo "  --headless         - Run in headless mode"
    echo "  --headed           - Run in headed mode (default)"
    echo "  --profile PATH     - Custom profile directory"
    echo "  --ui               - Run with Playwright UI"
    echo "  --open-profile     - Open persistent test profile only (for manual login/setup)"
    echo ""
    echo "Environment Variables:"
    echo "  CP_INDEED_SEARCH      - Job search term"
    echo "  CP_INDEED_LOCATION    - Location"
    echo "  CP_MAX_APPS           - Max applications"
    echo "  CP_INDEED_HEADLESS    - 1 for headless, 0 for headed"
    echo "  CP_INDEED_PROFILE_DIR - Profile directory path"
    echo ""
    echo "Examples:"
    echo "  $0 full --search \"python developer\" --location \"Remote\""
    echo "  $0 dry --headless"
    echo "  $0 full --max-apps 3"
    echo ""
    exit 1
}

# Parse arguments
TEST_TYPE="full"
USE_UI=false
EXTRA_ARGS=""
OPEN_PROFILE_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        full|dry|smartapply|all)
            TEST_TYPE="$1"
            shift
            ;;
        --search)
            SEARCH_TERM="$2"
            shift 2
            ;;
        --location)
            LOCATION="$2"
            shift 2
            ;;
        --max-apps)
            MAX_APPS="$2"
            shift 2
            ;;
        --headless)
            HEADLESS=1
            shift
            ;;
        --headed)
            HEADLESS=0
            shift
            ;;
        --profile)
            PROFILE_DIR="$2"
            shift 2
            ;;
        --ui)
            USE_UI=true
            shift
            ;;
        --open-profile)
            OPEN_PROFILE_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Print configuration
echo -e "${GREEN}Configuration:${NC}"
echo "  Test Type:    ${TEST_TYPE}"
echo "  Search Term:  ${SEARCH_TERM}"
echo "  Location:     ${LOCATION}"
echo "  Max Apps:     ${MAX_APPS}"
echo "  Headless:     $([ $HEADLESS -eq 1 ] && echo 'Yes' || echo 'No')"
echo "  Profile Dir:  ${PROFILE_DIR}"
echo "  UI Mode:      $([ $USE_UI = true ] && echo 'Yes' || echo 'No')"
echo "  Open Profile: $([ $OPEN_PROFILE_ONLY = true ] && echo 'Yes' || echo 'No')"
echo ""

# If no desktop session is available, force headless unless only opening profile.
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ] && [ "$HEADLESS" -eq 0 ] && [ "$OPEN_PROFILE_ONLY" = false ]; then
    echo -e "${YELLOW}⚠️  No GUI display detected (DISPLAY/WAYLAND_DISPLAY missing). Switching to headless mode.${NC}"
    echo -e "${YELLOW}   If you want profile UI, run this on a desktop session or use --open-profile locally.${NC}"
    HEADLESS=1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Ensure Playwright Chromium is installed for reliable persistent profile launches.
if ! npx playwright --version >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Playwright CLI not available, installing dependencies...${NC}"
        npm install
fi

echo -e "${GREEN}🔧 Ensuring Playwright Chromium is installed...${NC}"
npx playwright install chromium >/dev/null

# Create profile directory if it doesn't exist
mkdir -p "$PROFILE_DIR"

# Open profile mode (manual login/setup only)
if [ "$OPEN_PROFILE_ONLY" = true ]; then
        if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
                echo -e "${RED}❌ Cannot open browser UI: no GUI display detected.${NC}"
                echo -e "${YELLOW}Run with desktop session, then retry:${NC}"
                echo "  ./run-tests.sh --open-profile --profile \"$PROFILE_DIR\""
                exit 1
        fi

        echo -e "${BLUE}🧭 Opening persistent test profile for manual setup...${NC}"
        node -e '
            const { chromium } = require("@playwright/test");
            const path = process.argv[1];
            (async () => {
                const ctx = await chromium.launchPersistentContext(path, {
                    headless: false,
                    args: [
                        `--disable-extensions-except=${process.cwd()}`,
                        `--load-extension=${process.cwd()}`
                    ]
                });
                const page = ctx.pages()[0] || await ctx.newPage();
                await page.goto("https://www.indeed.com/", { waitUntil: "domcontentloaded" });
                console.log("Profile opened. Log in manually, then close the browser window.");
            })().catch((e) => {
                console.error(e);
                process.exit(1);
            });
        ' "$PROFILE_DIR"
        exit $?
fi

# Export environment variables
export CP_REAL_INDEED_TEST=1
export CP_INDEED_SEARCH="$SEARCH_TERM"
export CP_INDEED_LOCATION="$LOCATION"
export CP_MAX_APPS="$MAX_APPS"
export CP_INDEED_HEADLESS="$HEADLESS"
export CP_INDEED_PROFILE_DIR="$PROFILE_DIR"

# Build test command
if [ $USE_UI = true ]; then
    CMD="npx playwright test --ui"
else
    if [ $HEADLESS -eq 0 ]; then
        CMD="npx playwright test --headed"
    else
        CMD="npx playwright test"
    fi
fi

# Select test file
case $TEST_TYPE in
    full)
        CMD="$CMD tests/indeed-smartapply-full.spec.js"
        echo -e "${BLUE}🚀 Running full SmartApply flow test...${NC}"
        ;;
    dry)
        CMD="$CMD tests/live-indeed-smoke.spec.js"
        echo -e "${BLUE}🧪 Running dry-run smoke test...${NC}"
        ;;
    smartapply)
        CMD="$CMD tests/smartapply-real-world.spec.js"
        echo -e "${BLUE}🔄 Running original SmartApply test...${NC}"
        ;;
    all)
        CMD="$CMD tests/"
        echo -e "${BLUE}🎯 Running all tests...${NC}"
        ;;
esac

echo -e "${YELLOW}Command: $CMD${NC}"
echo ""

# Run the tests
echo -e "${GREEN}▶️  Starting tests...${NC}"
echo ""

if eval $CMD; then
    echo ""
    echo -e "${GREEN}✅ Tests completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 To view the HTML report, run:${NC}"
    echo "  npx playwright show-report"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Tests failed!${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Make sure you're logged into Indeed in the test browser"
    echo "  2. Check if Cloudflare is blocking automated browsers"
    echo "  3. Try with --headed to see what's happening"
    echo "  4. Review the HTML report: npx playwright show-report"
    exit 1
fi
