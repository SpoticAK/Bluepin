const fs = require('fs');
let code = fs.readFileSync('src/lib/utils.ts', 'utf8');

const regex = /export const downloadFile = async \(fileUrl: string, date: string\) => \{[\s\S]*?\n\};/m;
const replaceStr = `export const downloadFile = (fileUrl: string, date: string) => {
  try {
    if (fileUrl.startsWith('data:')) {
      const arr = fileUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], {type: mime});
      const downloadUrl = URL.createObjectURL(blob);
      const extension = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = \`Lab_Report_\${date}.\${extension}\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } else {
      // Remote URL: open immediately to avoid popup blockers blocking async window.open
      window.open(fileUrl, '_blank');
    }
  } catch (err) {
    console.error("Error downloading file:", err);
  }
};`;

if (code.match(regex)) {
  code = code.replace(regex, replaceStr);
  fs.writeFileSync('src/lib/utils.ts', code);
  console.log("Updated downloadFile in utils.ts with regex");
} else {
  console.log("Regex didn't match in utils.ts");
}
