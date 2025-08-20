
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Sale, SaleTransactionItem, StoreSettings, Language } from '../../types'; 
import { useLanguage } from '../../contexts/LanguageContext';
import Button from '../common/Button';
import SaleDetailModal from './SaleDetailModal';
import LoadingSpinner from '../common/LoadingSpinner';
import { getSales, isFirebaseInitialized, getStoreSettings } from '../../services/firebaseService';
import Input from '../common/Input';
import Card from '../common/Card'; 
import LaoFontInstallationHelp from '../common/LaoFontInstallationHelp';
import { UI_COLORS, VAT_RATE, PAYMENT_METHODS_OPTIONS, SALES_CHANNELS, DEFAULT_STORE_SETTINGS } from '../../constants';
import { jsPDF } from 'jspdf'; 
import 'jspdf-autotable'; // Import for side effects

declare var Swal: any; // For SweetAlert2

// --- IMPORTANT: PDF FONT DATA ---
// For Lao and Thai text to render correctly in PDFs, you MUST replace the following placeholder strings
// with the actual Base64 encoded content of your .ttf font files.
const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_LAO_FONT_BASE64_DATA_MUST_BE_REPLACED";
const NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_THAI_FONT_BASE64_DATA_MUST_BE_REPLACED";
// --- END IMPORTANT ---


// Icons
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h1v-4a1 1 0 011-1h10a1 1 0 011 1v4h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm3 0h4v3H8V4zm6 10a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg>;


const SalesHistoryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterReceiptNo, setFilterReceiptNo] = useState<string>('');
  const [filterCustomerName, setFilterCustomerName] = useState<string>('');

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState<Sale | null>(null);
  
  const currencySymbol = language === Language.LO ? t('currencyKip') : t('currencyBaht');
  const localeForFormatting = language === Language.LO ? 'lo-LA' : 'th-TH';

  const formatCurrencyStatic = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  const fetchSalesAndSettings = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      console.warn("Firebase not ready for fetching sales history data.");
      return;
    }
    setIsLoading(true);
    try {
      const [fetchedSales, fetchedStoreSettings] = await Promise.all([
          getSales(),
          getStoreSettings()
      ]);
      setAllSales(fetchedSales.sort((a,b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()));
      setStoreSettings(fetchedStoreSettings || DEFAULT_STORE_SETTINGS);
    } catch (error) {
      console.error("Error fetching sales history data:", error);
      Swal.fire(t('error'), t('errorOccurred'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSalesAndSettings();
  }, [fetchSalesAndSettings]);

  useEffect(() => {
    let salesResult = allSales;
    if (filterDate) {
      salesResult = salesResult.filter(sale => sale.transactionDate.startsWith(filterDate));
    }
    if (filterReceiptNo) {
      salesResult = salesResult.filter(sale => sale.receiptNumber.toLowerCase().includes(filterReceiptNo.toLowerCase()));
    }
    if (filterCustomerName) {
      salesResult = salesResult.filter(sale => sale.customerName?.toLowerCase().includes(filterCustomerName.toLowerCase()));
    }
    setFilteredSales(salesResult);
  }, [allSales, filterDate, filterReceiptNo, filterCustomerName]);

  const handleViewDetails = (sale: Sale) => {
    setSelectedSaleForDetail(sale);
    setIsDetailModalOpen(true);
  };
  
  const getSalesChannelText = (value?: string) => {
    if (!value) return '-';
    const option = SALES_CHANNELS.find(opt => opt.value === value);
    return option ? t(option.labelKey) : value;
  };
  
  const handlePrintReceipt = async (saleToPrint: Sale) => {
    if (!saleToPrint) return;
     if (isLoading) { 
        Swal.fire(t('loading'), t('errorLoadingStoreSettings'), 'info');
        return;
    }
    
    try {
        const doc = new jsPDF({ unit: 'mm' });
        let FONT_NAME = 'Helvetica'; 
        let FONT_FILE_NAME = '';
        let FONT_BASE64_DATA = '';
        let FONT_INTERNAL_NAME = '';

        const currentAppLanguage = language; 

        const formatCurrencyForPdf = (value: number) => {
            return value.toLocaleString(currentAppLanguage === Language.LO ? 'lo-LA' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
    
        const formatDateForPdf = (isoDate: string | undefined) => {
          if (!isoDate) return '-';
          return new Date(isoDate).toLocaleDateString(currentAppLanguage === Language.LO ? 'lo-LA' : 'th-TH', {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        };


        if (currentAppLanguage === 'th') {
            FONT_FILE_NAME = 'NotoSansThai-Regular.ttf';
            FONT_BASE64_DATA = NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER;
            FONT_INTERNAL_NAME = 'NotoSansThaiCustom';
        } else if (currentAppLanguage === Language.LO) { 
            FONT_FILE_NAME = 'NotoSansLao-Regular.ttf';
            FONT_BASE64_DATA = NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER;
            FONT_INTERNAL_NAME = 'NotoSansLaoCustom';
        }

        let customFontLoaded = false;
        if (FONT_BASE64_DATA && !FONT_BASE64_DATA.startsWith("PLACEHOLDER_") && (currentAppLanguage === Language.LO || currentAppLanguage === 'th')) {
            try {
                doc.addFileToVFS(FONT_FILE_NAME, FONT_BASE64_DATA);
                doc.addFont(FONT_FILE_NAME, FONT_INTERNAL_NAME, 'normal');
                FONT_NAME = FONT_INTERNAL_NAME;
                customFontLoaded = true;
                console.log(`Custom font '${FONT_NAME}' loaded successfully for PDF for language: ${currentAppLanguage}`);
            } catch (e) {
                console.error(`Critical error embedding custom font '${FONT_INTERNAL_NAME}'. PDF will use Helvetica. Error:`, e);
            }
        }

        if (!customFontLoaded) {
            FONT_NAME = 'Helvetica'; // Explicitly fall back to Helvetica
            if (currentAppLanguage === Language.LO || currentAppLanguage === 'th') {
                const helpContainer = document.createElement('div');
                const tempRoot = createRoot(helpContainer);
                tempRoot.render(<LaoFontInstallationHelp />);

                Swal.fire({
                    icon: 'warning',
                    title: t('pdfFontNotFoundTitle'),
                    html: helpContainer,
                    confirmButtonText: t('confirm'),
                    width: '800px'
                });
                const reason = (FONT_BASE64_DATA && FONT_BASE64_DATA.startsWith("PLACEHOLDER_"))
                    ? "placeholder Base64 data"
                    : "an error during font loading";
                console.warn(
                    `Custom font for ${currentAppLanguage === Language.LO ? 'Lao' : 'Thai'} was not loaded (due to ${reason}). ` +
                    `Falling back to Helvetica. A user-facing warning has been displayed.`
                );
            }
        }
        doc.setFont(FONT_NAME);

        const pageWidth = doc.internal.pageSize.getWidth();
        const leftMargin = 5;
        const rightMargin = 5;
        const contentWidth = pageWidth - leftMargin - rightMargin;
        let y = 10;
        const lineSpacing = 4; 
        const smallFontSize = 7;
        const regularFontSize = 8;
        const largeFontSize = 10;
        const headingFontSize = 12;

        // Store Info Block (Left Aligned)
        let currentInfoY = y;
        const infoX = leftMargin;
        const infoMaxWidth = contentWidth * 0.6;

        if (storeSettings.logoUrl) {
            const logoWidthMM = 20;
            const maxLogoHeightMM = 15;
            let actualLogoHeight = 0;
            try {
                await new Promise<void>((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        const aspectRatio = img.width / img.height;
                        actualLogoHeight = logoWidthMM / aspectRatio;
                        if (actualLogoHeight > maxLogoHeightMM) actualLogoHeight = maxLogoHeightMM;
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0);
                        const dataURL = canvas.toDataURL('image/png');
                        doc.addImage(dataURL, 'PNG', infoX, currentInfoY, logoWidthMM, actualLogoHeight);
                        currentInfoY += actualLogoHeight + 2; 
                        resolve();
                    };
                    img.onerror = (err) => {
                        console.warn("Failed to load logo for PDF from URL:", storeSettings.logoUrl, err);
                        resolve(); 
                    };
                    img.src = storeSettings.logoUrl;
                });
            } catch (e) { console.error("Error adding logo to PDF", e); }
        }
        
        doc.setFont(FONT_NAME, 'bold');
        doc.setFontSize(regularFontSize);
        doc.text(storeSettings.storeName, infoX, currentInfoY, { maxWidth: infoMaxWidth }); 
        currentInfoY += doc.getTextDimensions(storeSettings.storeName, { maxWidth: infoMaxWidth, fontSize: regularFontSize }).h + 1;

        doc.setFont(FONT_NAME, 'normal');
        doc.setFontSize(smallFontSize);
        doc.text(storeSettings.address, infoX, currentInfoY, { maxWidth: infoMaxWidth }); 
        currentInfoY += doc.getTextDimensions(storeSettings.address, { maxWidth: infoMaxWidth, fontSize: smallFontSize }).h + 1;
        
        const phoneText = `${t('receiptHeaderPhone')}: ${storeSettings.phone}`; 
        doc.text(phoneText, infoX, currentInfoY, { maxWidth: infoMaxWidth });
        currentInfoY += doc.getTextDimensions(phoneText, { maxWidth: infoMaxWidth, fontSize: smallFontSize }).h + 1;

        if (storeSettings.taxId) {
            const taxIdText = `${t('receiptHeaderTaxId')}: ${storeSettings.taxId}`; 
            doc.text(taxIdText, infoX, currentInfoY, { maxWidth: infoMaxWidth });
            currentInfoY += doc.getTextDimensions(taxIdText, { maxWidth: infoMaxWidth, fontSize: smallFontSize }).h +1;
        }
        const leftBlockBottomY = currentInfoY;


        // Receipt Heading (Right Side or Centered)
        const headingText = t('receiptSaleHeading'); 
        doc.setFont(FONT_NAME, 'bold');
        doc.setFontSize(headingFontSize);
        const headingTextWidth = doc.getTextWidth(headingText);
        const headingX = Math.max(infoX + infoMaxWidth + 5, pageWidth - rightMargin - headingTextWidth);
        const headingY = y + 3; 
        
        doc.text(headingText, headingX , headingY);
        
        const yPosAfterHeading = headingY + (headingFontSize * 0.35 * 2); 
        y = Math.max(leftBlockBottomY, yPosAfterHeading) + 3; 
        
        doc.setFont(FONT_NAME, 'normal'); 
        doc.setFontSize(regularFontSize);
        doc.text(`${t('receiptNumber')}: ${saleToPrint.receiptNumber}`, leftMargin, y); y += lineSpacing;
        doc.text(`${t('date')}: ${formatDateForPdf(saleToPrint.transactionDate)}`, leftMargin, y); y += lineSpacing;
        doc.text(`${t('customerName')}: ${saleToPrint.customerName}`, leftMargin, y); y += lineSpacing;
        if (saleToPrint.customerType === 'credit' && saleToPrint.dueDate) {
             doc.text(`${t('dueDate')}: ${formatDateForPdf(saleToPrint.dueDate)}`, leftMargin, y); y += lineSpacing;
        }

        y += 2; 
        doc.setLineWidth(0.1);
        doc.line(leftMargin, y, pageWidth - rightMargin, y); y += lineSpacing;
        
        doc.setFontSize(smallFontSize);
        (doc as any).autoTable({
            startY: y,
            head: [[t('productName'), t('quantity'), t('unitPrice'), t('totalPrice')]], 
            body: saleToPrint.items.map((item: SaleTransactionItem) => [
                item.productName, 
                item.quantity,    
                formatCurrencyForPdf(item.unitPriceAfterItemDiscount), 
                formatCurrencyForPdf(item.totalPrice)                  
            ]),
            theme: 'plain',
            styles: { fontSize: smallFontSize, font: FONT_NAME, cellPadding: 0.5 },
            headStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], font: FONT_NAME },
             columnStyles: {
                0: { cellWidth: 'auto' }, 
                1: { halign: 'right', cellWidth: 10 },
                2: { halign: 'right', cellWidth: 20 }, // Unit Price
                3: { halign: 'right', cellWidth: 20 }  // Total Price
            },
            margin: { left: leftMargin, right: rightMargin },
            didParseCell: (data: any) => { if (data.cell.section === 'head' || data.cell.section === 'body') { data.cell.styles.font = FONT_NAME; }}
        });
        y = (doc as any).lastAutoTable.finalY + lineSpacing;

        // Summary (Right Aligned)
        doc.setFontSize(regularFontSize);
        const summarySectionX = pageWidth / 2; 
        const summaryValueX = pageWidth - rightMargin;    

        const printSummaryLine = (labelKey: string, value: number | string, isBold = false) => {
            doc.setFont(FONT_NAME, isBold ? 'bold' : 'normal');
            doc.setFontSize(isBold ? largeFontSize : regularFontSize);
            doc.text(t(labelKey) + ':', summarySectionX, y, { align: 'left' });
            doc.text(typeof value === 'number' ? formatCurrencyForPdf(value) : value, summaryValueX, y, { align: 'right' });
            y += lineSpacing + (isBold ? 1 : 0);
        };
        
        printSummaryLine('subTotal', saleToPrint.subtotalAfterItemDiscounts);

        if (saleToPrint.overallSaleDiscountAmountCalculated > 0) {
             printSummaryLine('overallSaleDiscount', `-${formatCurrencyForPdf(saleToPrint.overallSaleDiscountAmountCalculated)}`);
        }
        
        if (saleToPrint.vatAmountFromEditableRate > 0) {
            printSummaryLine('vat', saleToPrint.vatAmountFromEditableRate);
        }
        
        y+= 1; 
        doc.setLineWidth(0.2);
        doc.line(summarySectionX - 2 , y, summaryValueX + 2, y); 
        y+=2;

        printSummaryLine('grandTotal', saleToPrint.grandTotal, true);
        
        y+=2;
        doc.setFont(FONT_NAME, 'normal');
        doc.setFontSize(regularFontSize);
        
        const paymentYStart = (doc as any).lastAutoTable.finalY + lineSpacing + 25; 
        y = Math.max(y, paymentYStart);

        const paymentMethodText = PAYMENT_METHODS_OPTIONS.find(pmo => pmo.value === saleToPrint.paymentMethod)?.labelKey || saleToPrint.paymentMethod;
        doc.text(`${t('paymentMethod')}: ${t(paymentMethodText)}`, leftMargin, y); y += lineSpacing;
        if (saleToPrint.paymentMethod === 'cash') {
          doc.text(`${t('receivedAmount')}: ${formatCurrencyForPdf(saleToPrint.receivedAmount || 0)}`, leftMargin, y); y += lineSpacing;
          doc.text(`${t('changeDue')}: ${formatCurrencyForPdf(saleToPrint.changeGiven || 0)}`, leftMargin, y); y += lineSpacing;
        } else if (saleToPrint.paymentMethod === 'credit') {
             doc.text(`${t('status')}: ${t(`status${saleToPrint.status.charAt(0).toUpperCase() + saleToPrint.status.slice(1)}`)}`, leftMargin, y); y += lineSpacing;
        }
        
        // Footer (Centered)
        y += lineSpacing;
        if(storeSettings.footerNote) {
            doc.setFontSize(smallFontSize);
            doc.text(storeSettings.footerNote, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth }); 
            y += lineSpacing * (Math.ceil(doc.getTextWidth(storeSettings.footerNote) / (contentWidth)));
        }
        doc.setFontSize(smallFontSize -1);
        doc.text(t('thankYouMessage') || "Thank you!", pageWidth / 2, y, {align: 'center'}); 
        
        doc.save(`receipt-${saleToPrint.receiptNumber || Date.now()}.pdf`);
    } catch (err) {
        console.error("Error generating PDF:", err);
        Swal.fire(t('error'), t('pdfLibraryNotLoaded') + (err as Error).message, 'error');
    }
  };

  const clearAllFilters = () => {
    setFilterDate('');
    setFilterReceiptNo('');
    setFilterCustomerName('');
  };

  const formatDateForDisplay = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  
  const getPaymentMethodLabel = (methodValue: string) => { 
     const option = PAYMENT_METHODS_OPTIONS.find(opt => opt.value === methodValue);
     return option ? t(option.labelKey) : methodValue;
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">{t('salesHistory')}</h1>
      
      {/* Filters Section */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <Input 
            label={t('filterByDate')}
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            wrapperClassName="mb-0"
          />
          <Input 
            label={t('filterByReceiptNo')}
            placeholder={t('receiptNumber') + '...'}
            value={filterReceiptNo}
            onChange={(e) => setFilterReceiptNo(e.target.value)}
            wrapperClassName="mb-0"
          />
          <Input 
            label={t('filterByCustomer')}
            placeholder={t('customerName') + '...'}
            value={filterCustomerName}
            onChange={(e) => setFilterCustomerName(e.target.value)}
            wrapperClassName="mb-0"
          />
          <Button onClick={clearAllFilters} variant="outline" className="w-full md:w-auto h-10">
            {t('clearFilters')}
          </Button>
        </div>
      </Card>

      {isLoading && !allSales.length ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner text={t('loading')} />
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('receiptNumber')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('date')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customerName')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('grandTotal')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('paymentMethod')}</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">{sale.receiptNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateForDisplay(sale.transactionDate)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.customerName || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrencyStatic(sale.grandTotal)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getPaymentMethodLabel(sale.paymentMethod)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(sale)} className="text-blue-600 hover:text-blue-900 p-1" title={t('viewSaleDetails')}><EyeIcon /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePrintReceipt(sale)} className="text-gray-600 hover:text-gray-900 p-1" title={t('reprintReceipt')}><PrintIcon /></Button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && !isLoading && (
                 <tr><td colSpan={6} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedSaleForDetail && (
        <SaleDetailModal 
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            sale={selectedSaleForDetail}
        />
      )}
    </div>
  );
};

export default SalesHistoryPage;