const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetImport = `import { cn, safeFormat } from '../lib/utils';`;
const replaceImport = `import { cn, safeFormat, downloadFile } from '../lib/utils';`;
code = code.replace(targetImport, replaceImport);

const targetHandleDownloadFn = `const handleDownloadFile = async (fileUrl: string, date: string) => {
  try {
    let downloadUrl = fileUrl;
    let extension = 'pdf';
    let isBlobUrl = false;
    
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
      downloadUrl = URL.createObjectURL(blob);
      extension = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
      isBlobUrl = true;
    } else {
      extension = fileUrl.toLowerCase().includes('.pdf') ? 'pdf' : (fileUrl.toLowerCase().includes('.png') ? 'png' : 'jpg');
      try {
        // Fetch to bypass CORS download attribute limitations
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error('CORS or Network issue');
        const blob = await res.blob();
        downloadUrl = URL.createObjectURL(blob);
        isBlobUrl = true;
      } catch (err) {
        console.warn("Failed to fetch blob, falling back to window.open", err);
        window.open(fileUrl, '_blank');
        return;
      }
    }
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = \`Lab_Report_\${safeFormat(date, 'yyyy-MM-dd')}.\${extension}\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (isBlobUrl) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    }
  } catch (err) {
    console.error("Error downloading file", err);
    window.open(fileUrl, '_blank');
  }
};`;

code = code.replace(targetHandleDownloadFn, '');
code = code.replace(/handleDownloadFile\(/g, 'downloadFile(');

fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
console.log("Updated BiomarkersTab.tsx");
