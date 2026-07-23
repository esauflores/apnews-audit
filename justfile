# justfile — AP News Performance Audit
# Run with: just <recipe>
# See all recipes: just --list

# Target pages (name \t url), one per line
TARGETS_FILE := "scripts/targets.tsv"

# Shared Lighthouse flags — see Day 3 §4.1 for the clean-state checklist.
CHROME_FLAGS := "--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/chromium-apnews-profile"
LH_FLAGS := "--only-categories=performance --form-factor=mobile --throttling-method=simulate --max-wait-for-load=20000 --skip-audits=bf-cache,font-size,screenshot,third-party-summary,uses-rel-preconnect,prioritize-lcp-image,total-byte-weight,uses-long-cache-ttl,uses-responsive-images,unused-css-rules,unused-javascript,modern-image-formats,render-blocking-resources,offscreen-images"

# Show all recipes (default)
default:
    @just --list --unsorted

# One-time setup: pre-accept OneTrust cookies so Lighthouse doesn't hang on the popup
setup:
    @node scripts/setup-profile.js
    @echo "✓ Profile ready."

# Generate preview PNGs of every slide in presentation.html
[doc("Render presentation.html slides → preview/")]
present:
    #!/usr/bin/env bash
    set -euo pipefail
    port=9556
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    sleep 0.5
    rm -rf preview && mkdir -p preview
    /usr/lib/chromium/chromium \
        --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
        --user-data-dir=/tmp/chromium-apnews-profile \
        --remote-debugging-port=$port \
        --window-size=1280,720 about:blank >/dev/null 2>&1 &
    sleep 2
    node -e '
      import("puppeteer-core").then(async ({default: puppeteer}) => {
        const browser = await puppeteer.connect({browserURL:"http://127.0.0.1:'"$port"'"});
        const pages = await browser.pages();
        const page = pages[0];
        await page.setViewport({width:1280,height:720});
        await page.goto("file://'"$(pwd)"'/presentation.html",{waitUntil:"networkidle2",timeout:30000});
        await new Promise(r=>setTimeout(r,2500));
        const total = await page.evaluate(() => Reveal.getTotalSlides());
        for (let i=0;i<total;i++) {
          await page.evaluate(n => Reveal.slide(n), i);
          await new Promise(r=>setTimeout(r,1500));
          await page.screenshot({path:"preview/slide-"+String(i+1).padStart(2,"0")+".png"});
        }
        await browser.disconnect();
      });'
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    @ls preview/

# Run Lighthouse on one URL. NAME defaults to a slug of the URL.
#   just audit https://apnews.com/
#   just audit https://apnews.com/world-news world-news
[doc("Run Lighthouse on one URL (mobile, simulated throttling)")]
audit url name="":
    #!/usr/bin/env bash
    set -euo pipefail
    url="{{ url }}"; name="{{ name }}"
    [[ -n "$name" ]] || name=$(echo "$url" | sed -E 's|https?://||; s|/$||; s|/+|-|g; s|[^a-zA-Z0-9._-]|-|g; s|-+|-|g')
    [[ -n "$name" ]] || name="page"
    mkdir -p lighthouse/logs
    log="lighthouse/logs/${name}.log"
    printf '→ [%s] %s\n' "$name" "$url"
    npx --yes lighthouse "$url" \
        --chrome-flags="{{ CHROME_FLAGS }}" \
        {{ LH_FLAGS }} \
        --output=json --output-path="lighthouse/${name}.json" \
        >"$log" 2>&1
    if [[ ! -s "lighthouse/${name}.json" ]]; then
        printf '✗ [%s] FAILED — see %s\n' "$name" "$log" >&2
        exit 1
    fi
    abs=$(realpath "lighthouse/${name}.json")
    node -e 'const r=require(process.argv[1]);const c=r.categories.performance;const a=r.audits;const fmt=v=>v==null?"—":v;console.log("  score:",fmt(Math.round((c.score||0)*100))," LCP:",fmt(a["largest-contentful-paint"]?.displayValue)," CLS:",fmt(a["cumulative-layout-shift"]?.displayValue)," TBT:",fmt(a["total-blocking-time"]?.displayValue))' "$abs"

# Run Lighthouse on all 8 target pages.
# Parallelism: 0/all, 1=sequential, N=N at a time
[doc("Run Lighthouse on all 8 target pages (parallel=N, default 1)")]
audit-all parallel="1":
    #!/usr/bin/env bash
    set -euo pipefail
    p="{{ parallel }}"
    [[ "$p" == "0" ]] && p=99
    [[ "$p" =~ ^[0-9]+$ ]] || { echo "✗ parallel must be a number (got '$p')"; exit 1; }
    (( p >= 1 )) || { echo "✗ parallel must be >=1 (got '$p')"; exit 1; }
    echo "→ Parallelism: $p"
    # -d '\n' splits on newlines; -I{} runs one command per input (no -n1 needed;
    # GNU xargs would warn that --max-args and --replace are mutually exclusive)
    while IFS=$'\t' read -r name url; do
        printf '%s\t%s\n' "$name" "$url"
    done < "{{ TARGETS_FILE }}" \
      | CHROME_FLAGS="{{ CHROME_FLAGS }}" LH_FLAGS="{{ LH_FLAGS }}" \
        xargs -d '\n' -P "$p" -I{} bash -c '
            mkdir -p lighthouse/logs
            line="$1"; name="${line%%	*}"; url="${line#*	}"
            log="lighthouse/logs/${name}.log"
            printf "→ [%s] %s\n" "$name" "$url"
            if npx --yes lighthouse "$url" --quiet \
                --chrome-flags="$CHROME_FLAGS" \
                $LH_FLAGS \
                --output=json --output-path="lighthouse/${name}.json" \
                >"$log" 2>&1 && [[ -s "lighthouse/${name}.json" ]]; then
                printf "  ✓ [%s] done\n" "$name"
            else
                printf "  ✗ [%s] FAILED — see %s\n" "$name" "$log"
            fi
        ' _ {}

# Capture build-output data from the homepage (JS/CSS bundles, image formats,
# 3rd-party loading strategy, source-map exposure). Writes /tmp/build-capture.json.
[doc("Inspect homepage build outputs (bundles, images, 3P loading strategy)")]
build-capture:
    @node scripts/build-capture.mjs

# Capture coverage (unused JS/CSS), frame chart (load/scroll/click),
# and layer/animation introspection. Writes /tmp/coverage-frame-capture.json.
[doc("Coverage + frame chart + layers & animations introspection")]
coverage-frames:
    @node scripts/coverage-frame-capture.mjs

# Detect rendering strategy per audited page (SSR vs CSR vs SSG).
# Writes /tmp/rendering-strategy.json.
[doc("Detect rendering strategy for each audited page")]
rendering-strategy:
    @node scripts/rendering-strategy.mjs

# Capture a single page screenshot
#   just screenshot https://apnews.com/ homepage
screenshot url name="":
    #!/usr/bin/env bash
    set -euo pipefail
    url="{{ url }}"; name="{{ name }}"
    [[ -n "$name" ]] || name=$(echo "$url" | sed -E 's|https?://||; s|/$||; s|/+|-|g; s|[^a-zA-Z0-9._-]|-|g; s|-+|-|g')
    mkdir -p screenshots
    pixelshot --output screenshots --backend cdp --viewport-width 1280 \
        --wait-network-idle --quality 85 "$url" 2>&1 | tail -2
    src="screenshots/${name}.png.tiles"
    [[ -f "$src/tile_0000.jpg" ]] && cp "$src/tile_0000.jpg" "screenshots/${name}-1.jpg"
    [[ -f "$src/tile_0001.jpg" ]] && cp "$src/tile_0001.jpg" "screenshots/${name}-2.jpg"
    rm -rf "$src"
    @echo "✓ screenshots/${name}-1.jpg"

# Capture all 8 target pages in parallel (pixelshot handles its own parallelism)
screenshots:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p screenshots
    pixelshot --output screenshots --backend cdp --viewport-width 1280 \
        --wait-network-idle --quality 85 $(awk '{printf "%s ", $0}' "{{ TARGETS_FILE }}") 2>&1 | tail -5
    for src in screenshots/*.png.tiles; do
        base=$(basename "$src" .png.tiles)
        [[ -f "$src/tile_0000.jpg" ]] && cp "$src/tile_0000.jpg" "screenshots/${base}-1.jpg"
        [[ -f "$src/tile_0001.jpg" ]] && cp "$src/tile_0001.jpg" "screenshots/${base}-2.jpg"
        rm -rf "$src"
    done
    @ls -la screenshots/*.jpg

# Markdown summary table of all captured scores
report:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "| Page | Perf | LCP | CLS | TBT | Status |"
    echo "|---|---|---|---|---|---|"
    for f in lighthouse/*.json; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f" .json)
        node -e 'const r=require(process.argv[1]);const c=r.categories.performance;const a=r.audits;const err=r.runtimeError?.code||"ok";const fmt=v=>v==null?"—":v;console.log("| "+process.argv[2]+" | "+fmt(Math.round((c.score||0)*100))+" | "+fmt(a["largest-contentful-paint"]?.displayValue)+" | "+fmt(a["cumulative-layout-shift"]?.displayValue)+" | "+fmt(a["total-blocking-time"]?.displayValue)+" | "+err+" |")' "$(realpath "$f")" "$name"
    done

# Wipe generated artifacts
clean:
    rm -rf lighthouse screenshots
    @echo "✓ Cleaned."
