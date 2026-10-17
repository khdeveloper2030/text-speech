const handleDownload = async (audioUrl, fileName = 'speech.mp3') => {
  try {
    const response = await fetch(audioUrl);
    const blob = await response.blob();

    // បង្កើត Link សម្រាប់ទាញយកក្នុង Local
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // លុប Object URL ចោលវិញដើម្បីសន្សំ Memory
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
  }
};