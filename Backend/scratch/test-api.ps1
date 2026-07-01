# Nova Store API Test Suite (PowerShell)
# Run: powershell -ExecutionPolicy Bypass -File scratch/test-api.ps1

$BASE = "http://localhost:5000/api/v1"
$script:PASS = 0
$script:FAIL = 0

# Shared state
$script:TOKEN = $null
$script:SESSION_COOKIE = $null
$script:BRAND_ID = $null
$script:CATEGORY_ID = $null
$script:SUBCATEGORY_ID = $null
$script:PRODUCT_ID = $null
$script:PRODUCT_SLUG = $null

# ---- Helpers ----------------------------------------------------------------

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null,
        [string]$Cookie = $null
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token)  { $headers["Authorization"] = "Bearer $Token" }
    if ($Cookie) { $headers["Cookie"] = $Cookie }

    $params = @{
        Method          = $Method
        Uri             = "$BASE$Path"
        Headers         = $headers
        UseBasicParsing = $true
        ErrorAction     = "SilentlyContinue"
    }
    if ($Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }

    try {
        $response = Invoke-WebRequest @params
        $data = $response.Content | ConvertFrom-Json
        return [PSCustomObject]@{ Status = $response.StatusCode; Data = $data; Headers = $response.Headers }
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd() | ConvertFrom-Json
            return [PSCustomObject]@{ Status = $code; Data = $content; Headers = @{} }
        }
        catch {
            return [PSCustomObject]@{ Status = $code; Data = @{ error = "no body" }; Headers = @{} }
        }
    }
}

function Log-Result {
    param([string]$Label, [string]$Status, [string]$Detail = "")
    $icon  = if ($Status -eq "PASS") { "[PASS]" } elseif ($Status -eq "SKIP") { "[SKIP]" } else { "[FAIL]" }
    $color = if ($Status -eq "PASS") { "Green"  } elseif ($Status -eq "SKIP") { "Yellow" } else { "Red"   }
    $msg   = "  $icon $Label"
    if ($Detail) { $msg += " -- $Detail" }
    Write-Host $msg -ForegroundColor $color
    if ($Status -eq "PASS") { $script:PASS++ } elseif ($Status -eq "FAIL") { $script:FAIL++ }
}

function Get-Ts { return [int](Get-Date -UFormat "%s") }

# ---- AUTH -------------------------------------------------------------------

Write-Host ""
Write-Host ">> AUTH" -ForegroundColor Cyan

$ts = Get-Ts

$regBody = [ordered]@{
    email              = "apitester$ts@novatest.dev"
    password           = "TestAdmin@2026!"
    confirmPassword    = "TestAdmin@2026!"
    firstName          = "API"
    lastName           = "Tester"
    phoneNumber        = "+2348012345678"
    phoneCountryCode   = "+234"
    homeAddress        = [ordered]@{ street = "123 Test St"; city = "Lagos"; state = "Lagos"; postalCode = "100001"; country = "Nigeria" }
    referralSource     = "other"
}
$reg = Invoke-Api -Method POST -Path "/auth/register" -Body $regBody
if ($reg.Status -eq 201 -or $reg.Status -eq 200 -or $reg.Status -eq 409) {
    Log-Result "POST /auth/register" "PASS" "Status: $($reg.Status)"
} else {
    Log-Result "POST /auth/register" "FAIL" "Status: $($reg.Status)"
    Write-Host "    REGISTER BODY: $($reg.Data | ConvertTo-Json -Depth 6)" -ForegroundColor DarkGray
}

# Try admin session login (returns Bearer token)
$adminCreds = [ordered]@{ email = "apitester$ts@novatest.dev"; password = "TestAdmin@2026!" }
$adminLogin  = Invoke-Api -Method POST -Path "/admin/login" -Body $adminCreds

if ($adminLogin.Status -eq 200 -and $adminLogin.Data.data.accessToken) {
    $script:TOKEN = $adminLogin.Data.data.accessToken
    Log-Result "POST /admin/login" "PASS" "Bearer token acquired"
}
else {
    # Try customer login (session-based)
    $loginBody   = [ordered]@{ email = "apitester$ts@novatest.dev"; password = "TestAdmin@2026!" }
    $loginResp   = Invoke-Api -Method POST -Path "/auth/login" -Body $loginBody
    if ($loginResp.Status -eq 200) {
        $rawCookie = $loginResp.Headers["Set-Cookie"]
        if ($rawCookie) { $script:SESSION_COOKIE = ($rawCookie -split ";")[0] }
        Log-Result "POST /auth/login (customer)" "PASS" "Session-based auth"
        Write-Host "    NOTE: Using customer session -- some admin-only routes may return 403" -ForegroundColor Yellow
    }
    else {
        Log-Result "POST /auth/login" "FAIL" "Status: $($loginResp.Status)"
        Write-Host "    LOGIN BODY: $($loginResp.Data | ConvertTo-Json -Depth 6)" -ForegroundColor DarkGray
        Write-Host "" 
        Write-Host "[ABORT] Cannot proceed without auth token." -ForegroundColor Red
        exit 1
    }
}

# ---- BRANDS -----------------------------------------------------------------

Write-Host ""
Write-Host ">> BRANDS" -ForegroundColor Cyan

# GET all brands (public)
$r = Invoke-Api -Method GET -Path "/brands"
Log-Result "GET /brands" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# POST create brand
$brandName = "TestBrand-$(Get-Ts)"
$brandBody = [ordered]@{
    name             = $brandName
    description      = "Auto-generated test brand for API testing."
    logo_url         = "https://placehold.co/200x200.png"
    website_url      = "https://testbrand.example.com"
    is_featured      = $false
    meta_title       = "Test Brand | Nova Store"
    meta_description = "Shop Test Brand products at Nova Store."
}
$r = Invoke-Api -Method POST -Path "/brands" -Body $brandBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
if ($r.Status -eq 201 -and $r.Data.data.brand.id) {
    $script:BRAND_ID = $r.Data.data.brand.id
    Log-Result "POST /brands" "PASS" "id: $($script:BRAND_ID)"
} else {
    Log-Result "POST /brands" "FAIL" "Status: $($r.Status) -- $($r.Data | ConvertTo-Json -Compress)"
}

# POST without required name field -> expect 422
$r = Invoke-Api -Method POST -Path "/brands" -Body @{ description = "No name" } -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
Log-Result "POST /brands (no name -> 422)" $(if ($r.Status -eq 422) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# GET brand by ID
if ($script:BRAND_ID) {
    $r = Invoke-Api -Method GET -Path "/brands/$($script:BRAND_ID)"
    Log-Result "GET /brands/:id" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

    # PATCH update
    $r = Invoke-Api -Method PATCH -Path "/brands/$($script:BRAND_ID)" -Body @{ is_featured = $true; meta_description = "Updated by test." } -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    Log-Result "PATCH /brands/:id" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

    # PATCH empty body -> 422
    $r = Invoke-Api -Method PATCH -Path "/brands/$($script:BRAND_ID)" -Body @{} -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    Log-Result "PATCH /brands/:id (empty body -> 422)" $(if ($r.Status -eq 422) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
}

# ---- CATEGORIES -------------------------------------------------------------

Write-Host ""
Write-Host ">> CATEGORIES" -ForegroundColor Cyan

# GET all
$r = Invoke-Api -Method GET -Path "/categories"
Log-Result "GET /categories" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# GET tree view
$r = Invoke-Api -Method GET -Path "/categories?type=tree"
Log-Result "GET /categories?type=tree" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# POST create category -- minimal (no description, no image_url)
$catName = "TestCat-$(Get-Ts)"
$catBody = [ordered]@{
    name             = $catName
    icon             = "T"
    color            = "#4285F4"
    sort_order       = 99
    is_featured      = $true
    meta_title       = "Test Category | Nova Store"
    meta_description = "Auto-generated test category."
}
$r = Invoke-Api -Method POST -Path "/categories" -Body $catBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
if ($r.Status -eq 201 -and $r.Data.data.category.id) {
    $script:CATEGORY_ID = $r.Data.data.category.id
    Log-Result "POST /categories (minimal -- no description/image)" "PASS" "id: $($script:CATEGORY_ID)"
} else {
    Log-Result "POST /categories (minimal)" "FAIL" "Status: $($r.Status) -- $($r.Data | ConvertTo-Json -Compress)"
}

# POST create category with ALL fields (including new color field)
$fullCatName = "FullCat-$(Get-Ts)"
$fullCatBody = [ordered]@{
    name             = $fullCatName
    description      = "A full test category with all fields provided."
    image_url        = "https://placehold.co/800x400.png"
    thumbnail_url    = "https://placehold.co/200x200.png"
    icon             = "F"
    color            = "#EA4335"
    sort_order       = 100
    is_featured      = $false
    meta_title       = "Full Category | Nova Store"
    meta_description = "Test category with all optional fields."
    meta_keywords    = @("test", "category", "nova")
}
$r = Invoke-Api -Method POST -Path "/categories" -Body $fullCatBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
Log-Result "POST /categories (all fields + color)" $(if ($r.Status -eq 201) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# POST subcategory under root category
if ($script:CATEGORY_ID) {
    $subCatBody = [ordered]@{
        name     = "SubCat-$(Get-Ts)"
        icon     = "S"
        color    = "#34A853"
        parentId = $script:CATEGORY_ID
    }
    $r = Invoke-Api -Method POST -Path "/categories" -Body $subCatBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    if ($r.Status -eq 201 -and $r.Data.data.category.id) {
        $script:SUBCATEGORY_ID = $r.Data.data.category.id
        Log-Result "POST /categories (subcategory)" "PASS" "id: $($script:SUBCATEGORY_ID)"
    } else {
        Log-Result "POST /categories (subcategory)" "FAIL" "Status: $($r.Status) -- $($r.Data | ConvertTo-Json -Compress)"
    }
}

# GET by ID
if ($script:CATEGORY_ID) {
    $r = Invoke-Api -Method GET -Path "/categories/$($script:CATEGORY_ID)"
    Log-Result "GET /categories/:id" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
}

# GET subcategories list
if ($script:CATEGORY_ID) {
    $r = Invoke-Api -Method GET -Path "/categories/$($script:CATEGORY_ID)/subcategories"
    Log-Result "GET /categories/:id/subcategories" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
}

# PATCH update category with color field
if ($script:CATEGORY_ID) {
    $r = Invoke-Api -Method PATCH -Path "/categories/$($script:CATEGORY_ID)" -Body @{ color = "#FBBC04"; description = "Updated by API test." } -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    Log-Result "PATCH /categories/:id (with color)" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
}

# ---- PRODUCTS ---------------------------------------------------------------

Write-Host ""
Write-Host ">> PRODUCTS" -ForegroundColor Cyan

# GET all products (public)
$r = Invoke-Api -Method GET -Path "/products"
Log-Result "GET /products" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# GET featured products
$r = Invoke-Api -Method GET -Path "/products/featured"
Log-Result "GET /products/featured" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# GET search
$r = Invoke-Api -Method GET -Path "/products/search?q=test"
Log-Result "GET /products/search?q=test" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

# GET recommendations
$r = Invoke-Api -Method GET -Path "/products/recommendations?limit=5"
Log-Result "GET /products/recommendations" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

if (-not $script:CATEGORY_ID) {
    Log-Result "POST /products (all variants)" "SKIP" "No categoryId available"
}
else {
    $ts2 = Get-Ts

    # POST minimal product (required fields only: sku, name, category_id, price)
    $minBody = [ordered]@{
        sku         = "MIN-$ts2"
        name        = "Minimal Test Product"
        category_id = $script:CATEGORY_ID
        price       = 29.99
    }
    $r = Invoke-Api -Method POST -Path "/products" -Body $minBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    if ($r.Status -eq 201 -and $r.Data.data.product.id) {
        Log-Result "POST /products (minimal -- 4 required fields)" "PASS" "id: $($r.Data.data.product.id)"
    } else {
        Log-Result "POST /products (minimal)" "FAIL" "Status: $($r.Status) -- $($r.Data | ConvertTo-Json -Compress)"
    }

    # POST full product with ALL new fields
    $fullBody = [ordered]@{
        sku               = "FULL-$ts2"
        name              = "Full-Feature Earbuds $ts2"
        description       = "Premium noise-cancelling earbuds with 30hr battery."
        short_description = "Best-in-class ANC earbuds."
        category_id       = $script:CATEGORY_ID
        subcategory_id    = $script:SUBCATEGORY_ID
        brand_id          = $script:BRAND_ID
        price             = 199.99
        sale_price        = 149.99
        cost_price        = 75.00
        stock_quantity    = 50
        status            = "published"
        is_featured       = $true
        allow_backorder   = $false
        track_inventory   = $true
        currency          = "USD"
        color             = "#1A1A2E"
        weight            = 0.25
        dimensions_length = 15.0
        dimensions_width  = 8.0
        dimensions_height = 3.5
        tags              = @("wireless", "noise-cancelling", "premium", "earbuds")
        meta_title        = "Wireless Earbuds Pro | Nova Store"
        meta_description  = "Shop premium wireless earbuds with ANC at Nova Store."
        meta_keywords     = @("wireless earbuds", "ANC", "noise cancelling")
        primary_image_url = "https://placehold.co/800x800.png"
        thumbnail_url     = "https://placehold.co/200x200.png"
        image_gallery     = @("https://placehold.co/800x800.png", "https://placehold.co/400x400.png")
        variants          = @(
            [ordered]@{ sku = "VAR-BLK-$ts2"; name = "Midnight Black"; option_values = @{ color = "Black" }; stock_quantity = 30 },
            [ordered]@{ sku = "VAR-WHT-$ts2"; name = "Pearl White";    option_values = @{ color = "White" }; stock_quantity = 20 }
        )
    }
    $r = Invoke-Api -Method POST -Path "/products" -Body $fullBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    if ($r.Status -eq 201 -and $r.Data.data.product.id) {
        $script:PRODUCT_ID   = $r.Data.data.product.id
        $script:PRODUCT_SLUG = $r.Data.data.product.slug
        $saved = $r.Data.data.product
        Log-Result "POST /products (all new fields)" "PASS" "id: $($script:PRODUCT_ID)"
        Log-Result "  -> color saved"             $(if ($saved.color -eq "#1A1A2E") { "PASS" } else { "FAIL" }) "Got: $($saved.color)"
        Log-Result "  -> weight saved"            $(if ($null -ne $saved.weight)            { "PASS" } else { "FAIL" }) "Got: $($saved.weight)"
        Log-Result "  -> dimensions_length saved" $(if ($null -ne $saved.dimensions_length) { "PASS" } else { "FAIL" }) "Got: $($saved.dimensions_length)"
        Log-Result "  -> cost_price saved"        $(if ($null -ne $saved.cost_price)        { "PASS" } else { "FAIL" }) "Got: $($saved.cost_price)"
        Log-Result "  -> tags saved"              $(if ($null -ne $saved.tags)              { "PASS" } else { "FAIL" }) "Got: $($saved.tags -join ',')"
    } else {
        Log-Result "POST /products (all new fields)" "FAIL" "Status: $($r.Status) -- $($r.Data | ConvertTo-Json -Compress)"
    }

    # POST with missing required fields -> expect 422
    $r = Invoke-Api -Method POST -Path "/products" -Body @{ name = "No SKU or category" } -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
    Log-Result "POST /products (missing required -> 422)" $(if ($r.Status -eq 422) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

    if ($script:PRODUCT_ID) {
        # GET by ID
        $r = Invoke-Api -Method GET -Path "/products/$($script:PRODUCT_ID)"
        Log-Result "GET /products/:id" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

        # GET by slug
        if ($script:PRODUCT_SLUG) {
            $r = Invoke-Api -Method GET -Path "/products/slug/$($script:PRODUCT_SLUG)"
            Log-Result "GET /products/slug/:slug" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
        }

        # GET stock check
        $r = Invoke-Api -Method GET -Path "/products/$($script:PRODUCT_ID)/stock"
        Log-Result "GET /products/:id/stock" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

        # PATCH update with new fields
        $patchBody = [ordered]@{
            color            = "#FF6B35"
            weight           = 0.30
            tags             = @("wireless", "earbuds", "updated")
            meta_description = "Updated by API test suite."
            allow_backorder  = $true
        }
        $r = Invoke-Api -Method PATCH -Path "/products/$($script:PRODUCT_ID)" -Body $patchBody -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
        Log-Result "PATCH /products/:id (new fields)" $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

        # PATCH empty body -> 422
        $r = Invoke-Api -Method PATCH -Path "/products/$($script:PRODUCT_ID)" -Body @{} -Token $script:TOKEN -Cookie $script:SESSION_COOKIE
        Log-Result "PATCH /products/:id (empty body -> 422)" $(if ($r.Status -eq 422) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
    }

    # GET filter by category
    $r = Invoke-Api -Method GET -Path "/products?category_id=$($script:CATEGORY_ID)"
    Log-Result "GET /products?category_id=..." $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"

    if ($script:BRAND_ID) {
        $r = Invoke-Api -Method GET -Path "/products?brand_id=$($script:BRAND_ID)"
        Log-Result "GET /products?brand_id=..." $(if ($r.Status -eq 200) { "PASS" } else { "FAIL" }) "Status: $($r.Status)"
    }
}

# ---- SUMMARY ----------------------------------------------------------------

Write-Host ""
Write-Host ("=" * 55) -ForegroundColor White
$color = if ($script:FAIL -eq 0) { "Green" } else { "Red" }
Write-Host "RESULTS: $($script:PASS) passed, $($script:FAIL) failed" -ForegroundColor $color
Write-Host ("=" * 55) -ForegroundColor White

if ($script:BRAND_ID)       { Write-Host "Brand ID:      $($script:BRAND_ID)"       -ForegroundColor Cyan }
if ($script:CATEGORY_ID)    { Write-Host "Category ID:   $($script:CATEGORY_ID)"    -ForegroundColor Cyan }
if ($script:SUBCATEGORY_ID) { Write-Host "Subcategory ID: $($script:SUBCATEGORY_ID)" -ForegroundColor Cyan }
if ($script:PRODUCT_ID)     { Write-Host "Product ID:    $($script:PRODUCT_ID)"     -ForegroundColor Cyan }
if ($script:PRODUCT_SLUG)   { Write-Host "Product Slug:  $($script:PRODUCT_SLUG)"   -ForegroundColor Cyan }
Write-Host ""
Write-Host "Check these records in your Supabase dashboard!" -ForegroundColor Green
