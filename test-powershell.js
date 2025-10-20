// Test PowerShell screenshot
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Testing PowerShell screenshot...\n');

const outputPath = path.join(__dirname, 'test-screenshot.png');

// PowerShell script to take screenshot
const psScript = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$screens = [Windows.Forms.Screen]::AllScreens
$bounds = $screens[0].Bounds
$bitmap = New-Object Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}', [Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;

exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }

  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    console.log('✅ SUCCESS! Captured screenshot:');
    console.log(`   Path: ${outputPath}`);
    console.log(`   Size: ${stats.size} bytes`);

    // Read it as buffer
    const buffer = fs.readFileSync(outputPath);
    console.log(`   Buffer size: ${buffer.length} bytes`);
    console.log(`   Is Buffer: ${Buffer.isBuffer(buffer)}`);

    // Clean up
    fs.unlinkSync(outputPath);
    console.log('\n✅ PowerShell screenshot works!');
    process.exit(0);
  } else {
    console.error('❌ Screenshot file was not created');
    process.exit(1);
  }
});
