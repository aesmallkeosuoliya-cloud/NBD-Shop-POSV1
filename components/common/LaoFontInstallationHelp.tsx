
import React from 'react';

const LaoFontInstallationHelp: React.FC = () => {

  const codeBlockStyle: React.CSSProperties = {
    backgroundColor: '#f4f4f4',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontSize: '0.85rem',
    color: '#333'
  };

  const listItemStyle: React.CSSProperties = {
    marginBottom: '10px'
  };

  return (
    <div style={{ textAlign: 'left', fontSize: '14px', color: '#333', fontFamily: "'Noto Sans Lao', 'Noto Sans', sans-serif" }}>
      <p style={{ marginBottom: '16px' }}>
        เพื่อให้เอกสาร PDF แสดงผลภาษาลาวและไทยได้อย่างถูกต้อง คุณจำเป็นต้องติดตั้งฟอนต์ลงในโค้ดของโปรแกรมโดยตรง เนื่องจากไลบรารีที่ใช้สร้าง PDF ไม่รู้จักฟอนต์เหล่านี้เป็นค่าเริ่มต้น
        <br />
        <em>To ensure Lao and Thai text displays correctly in PDF documents, you need to embed the font files directly into the application's code. The library used for PDF generation does not include these fonts by default.</em>
      </p>

      <h4 style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: '#000' }}>ขั้นตอนการติดตั้งฟอนต์ (Steps to install fonts):</h4>
      <ol style={{ listStyleType: 'decimal', paddingLeft: '20px', margin: 0 }}>
        <li style={listItemStyle}>
          <strong>ดาวน์โหลดฟอนต์ (Download the font):</strong>
          <p style={{ paddingLeft: '16px', marginTop: '4px' }}>
            คุณสามารถใช้ฟอนต์ Phetsarath OT หรือ Noto Sans Lao สำหรับภาษาลาว และ Noto Sans Thai สำหรับภาษาไทย
            <br />
            <em>You can use "Phetsarath OT" or "Noto Sans Lao" for Lao, and "Noto Sans Thai" for Thai.</em>
            <br />
            <a href="https://fonts.google.com/specimen/Noto+Sans+Lao" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Download Noto Sans Lao from Google Fonts</a>
            <br />
            <a href="https://fonts.google.com/specimen/Noto+Sans+Thai" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Download Noto Sans Thai from Google Fonts</a>
          </p>
        </li>
        <li style={listItemStyle}>
          <strong>แปลงฟอนต์เป็น Base64 (Convert font to Base64):</strong>
          <p style={{ paddingLeft: '16px', marginTop: '4px' }}>
            เมื่อได้ไฟล์ .ttf มาแล้ว ให้ใช้เครื่องมือออนไลน์เพื่อแปลงไฟล์เป็นข้อความรูปแบบ Base64
            <br />
            <em>Once you have the .ttf font file, use an online tool to convert the file into a Base64 text string.</em>
            <br />
            <a href="https://www.base64-image.de/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Example Base64 Converter Tool</a>
            <br/>
            <em>(Note: Drag and drop your .ttf file, then copy the generated text string from the "Copy to clipboard" field.)</em>
          </p>
        </li>
        <li style={listItemStyle}>
          <strong>นำโค้ด Base64 ไปวางในไฟล์โปรแกรม (Paste the Base64 code into the files):</strong>
          <p style={{ paddingLeft: '16px', marginTop: '4px' }}>
            เปิดไฟล์โปรแกรมต่อไปนี้ และนำข้อความ Base64 ที่คัดลอกมา ไปวางแทนที่ข้อความ placeholder
            <br/>
            <em>Open the following files in the project and replace the placeholder text with the Base64 string you copied.</em>
          </p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '32px', marginTop: '8px' }}>
            <li><code>components/pos/POSPage.tsx</code></li>
            <li><code>components/salesHistory/SalesHistoryPage.tsx</code></li>
            <li><code>components/creditTracking/CreditTrackingPage.tsx</code></li>
            <li><code>components/reports/ProfitLossPage.tsx</code></li>
          </ul>
        </li>
        <li style={listItemStyle}>
          <strong>ตัวอย่างโค้ดที่ต้องแก้ไข (Example code to edit):</strong>
          <p style={{ paddingLeft: '16px', marginTop: '4px' }}>
            มองหาตัวแปรที่ชื่อคล้ายๆ แบบนี้ในไฟล์ แล้ววางโค้ด Base64 ของคุณลงไป
            <br />
            <em>Look for a variable like this in the files and paste your Base64 code.</em>
          </p>
          <div style={codeBlockStyle}>
            const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_...";
            <br /><br />
            <strong>แก้เป็น (Change to):</strong>
            <br /><br />
            const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "AAEAAAAPAIAAAwBwRkZUTWFk....(ข้อความ Base64 ที่ยาวมาก)...";
          </div>
        </li>
      </ol>
      <p style={{ marginTop: '16px', fontWeight: 600, color: '#DC2626' }}>
        สำคัญ: หากไม่ทำขั้นตอนนี้ ข้อความภาษาลาวและไทยในไฟล์ PDF จะแสดงผลเป็นตัวอักษรที่อ่านไม่ออก (ตัวอักษรต่างดาว)
        <br />
        <em>Important: If this step is not completed, Lao and Thai text in PDF files will be garbled and unreadable.</em>
      </p>
    </div>
  );
};

export default LaoFontInstallationHelp;