# Create a high-grade Code Signing Certificate for Kernn Automations Pvt. Ltd.
$certName = "Kernn Automations Pvt. Ltd."
$certPassword = ConvertTo-SecureString -String "KernnAuth2026!" -Force -AsPlainText
$certPath = Join-Path $PSScriptRoot "..\desktop-bridge\build\kernn-codesign.pfx"

Write-Host "Creating Code Signing Certificate for: $certName"

# Create self-signed code signing cert with 10-year validity
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$certName, O=Kernn Automations Pvt. Ltd., C=IN" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(10)

# Export PFX
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $certPassword

# Install to Trusted Root & Trusted Publishers for local machine trust
try {
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()

    $pubStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "CurrentUser")
    $pubStore.Open("ReadWrite")
    $pubStore.Add($cert)
    $pubStore.Close()
    Write-Host "[OK] Certificate trusted on local system. Windows UAC will show verified publisher: $certName"
} catch {
    Write-Host "[WARN] Run as admin to install into Trusted Root, or cert is available at $certPath"
}

Write-Host "[OK] Code signing certificate exported to $certPath"
