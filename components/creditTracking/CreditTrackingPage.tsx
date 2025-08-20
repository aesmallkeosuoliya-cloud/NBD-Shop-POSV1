import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Sale, Customer, CreditCustomerSummary, CreditInvoiceStatus, StoreSettings, Language } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSales, getCustomers, isFirebaseInitialized, getStoreSettings } from '../../services/firebaseService';
import Input from '../common/Input';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import CustomerCreditDetailModal from './CustomerCreditDetailModal';
import LaoFontInstallationHelp from '../common/LaoFontInstallationHelp';
import { UI_COLORS, DEFAULT_STORE_SETTINGS } from '../../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf'; 
import 'jspdf-autotable'; // Import for side effects

declare var Swal: any;

// --- IMPORTANT: PDF FONT DATA ---
// For Lao and Thai text to render correctly in PDFs, you MUST replace the following placeholder strings
// with the actual Base64 encoded content of your .ttf font files.
const NOTO_SANS_LAO_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_LAO_FONT_BASE64_DATA_MUST_BE_REPLACED";
const NOTO_SANS_THAI_REGULAR_TTF_BASE64_PLACEHOLDER = "PLACEHOLDER_THAI_FONT_BASE64_DATA_MUST_BE_REPLACED";
// --- END IMPORTANT ---


interface IconProps {
  className?: string;
}

const FilterIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;
const ViewIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className || ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>;
const PaymentIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className || ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>;
const ExcelIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className || ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm0 2a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zm13 10a2 2 0 012 2v2a1 1 0 11-2 0v-2a2 2 0 01-2-2h-2a2 2 0 01-2 2H8a2 2 0 01-2-2H3a1 1 0 110-2h3v2a4 4 0 004 4h2a4 4 0 004-4v-2h3zm-7-2a1 1 0 000-2H8a3 3 0 00-3 3v2a1 1 0 102 0v-2a1 1 0 011-1h2z" /></svg>;
const PDFIcon: React.FC<IconProps> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className || ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;


export const CreditTrackingPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [creditCustomerSummaries, setCreditCustomerSummaries] = useState<CreditCustomerSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<CreditCustomerSummary[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<CreditCustomerSummary | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDueDateFrom, setFilterDueDateFrom] = useState('');
  const [filterDueDateTo, setFilterDueDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<CreditInvoiceStatus | 'all'>('all');

  const localeForFormatting = language === Language.LO ? 'lo-LA' : 'th-TH';

  const formatCurrency = (value: number | null | undefined) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString(localeForFormatting, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDate = (isoDate: string | undefined) => {
    if (!isoDate) return '-';
    return new Date(isoDate).toLocaleDateString(localeForFormatting, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const calculateOverallStatus = (earliestDueDate?: string): CreditInvoiceStatus => {
    if (!earliestDueDate) return 'unpaid'; 
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = new Date(earliestDueDate);
    dueDate.setHours(0,0,0,0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'due_soon'; 
    return 'pending';
  };

  const fetchData = useCallback(async () => {
    if (!isFirebaseInitialized()) return;
    setIsLoading(true);
    try {
      const [sales, customers, settings] = await Promise.all([
          getSales(), 
          getCustomers(),
          getStoreSettings()
        ]);
      setAllSales(sales);
      setAllCustomers(customers);
      setStoreSettings(settings || DEFAULT_STORE_SETTINGS);

      const customerMap = new Map(customers.map(c => [c.id, c]));
      const creditSales = sales.filter(s => s.paymentMethod === 'credit' && (s.status === 'unpaid' || s.status === 'partially_paid'));
      
      const summariesMap = new Map<string, CreditCustomerSummary>();

      creditSales.forEach(sale => {
        if (!sale.customerId) return; 
        
        let summary = summariesMap.get(sale.customerId);
        if (!summary) {
          const customer = customerMap.get(sale.customerId);
          summary = {
            customerId: sale.customerId,
            customerName: customer?.name || sale.customerName || t('unknown'),
            customerPhone: customer?.phone || sale.customerPhone,
            openInvoicesCount: 0,
            totalOutstandingAmount: 0,
            earliestDueDate: undefined,
            overallStatus: 'pending' 
          };
        }
        
        summary.openInvoicesCount += 1;
        summary.totalOutstandingAmount += sale.outstandingAmount;
        if (sale.dueDate) {
          if (!summary.earliestDueDate || new Date(sale.dueDate) < new Date(summary.earliestDueDate)) {
            summary.earliestDueDate = sale.dueDate;
          }
        }
        summariesMap.set(sale.customerId, summary);
      });
      
      const summariesArray = Array.from(summariesMap.values()).map(s => ({
          ...s,
          overallStatus: calculateOverallStatus(s.earliestDueDate)
      })).sort((a,b) => a.customerName.localeCompare(b.customerName));

      setCreditCustomerSummaries(summariesArray);

    } catch (err) {
      console.error("Error fetching credit tracking data:", err);
      Swal.fire(t('error'), t('errorFetchingData'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let filtered = creditCustomerSummaries;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.customerName.toLowerCase().includes(lowerSearch) ||
        (s.customerPhone && s.customerPhone.includes(lowerSearch)) ||
        s.customerId.toLowerCase().includes(lowerSearch)
      );
    }

    if (filterDueDateFrom) {
        filtered = filtered.filter(s => s.earliestDueDate && new Date(s.earliestDueDate) >= new Date(filterDueDateFrom));
    }
    if (filterDueDateTo) {
        filtered = filtered.filter(s => s.earliestDueDate && new Date(s.earliestDueDate) <= new Date(filterDueDateTo));
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.overallStatus === filterStatus);
    }

    setFilteredSummaries(filtered);
  }, [searchTerm, filterDueDateFrom, filterDueDateTo, filterStatus, creditCustomerSummaries]);


  const handleViewDetails = (customerSummary: CreditCustomerSummary) => {
    setSelectedCustomerForDetail(customerSummary);
    setIsDetailModalOpen(true);
  };
  
  const handlePaymentRecorded = () => {
    fetchData(); 
    setIsDetailModalOpen(false); 
    setSelectedCustomerForDetail(null);
  }

  const getStatusColor = (status: CreditInvoiceStatus) => {
    switch (status) {
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'due_soon': return 'bg-orange-100 text-orange-700';
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'paid': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };
  
  const exportToExcel = () => {
    const dataToExport = filteredSummaries.map((item, index) => ({
        [t('idx')]: index + 1,
        [t('customerName')]: item.customerName,
        [t('phone')]: item.customerPhone || '-',
        [t('openInvoices')]: item.openInvoicesCount,
        [t('totalOutstanding')]: item.totalOutstandingAmount,
        [t('earliestDueDate')]: formatDate(item.earliestDueDate),
        [t('status')]: t(`status${item.overallStatus.charAt(0).toUpperCase() + item.overallStatus.slice(1)}`)
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('creditTrackingPageTitle'));
    XLSX.writeFile(workbook, `${t('creditTrackingPageTitle')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = async () => {
     try {
        const doc = new jsPDF({ unit: 'mm'});
        let FONT_NAME = 'Helvetica'; 
        let FONT_FILE_NAME = '';
        let FONT_BASE64_DATA = '';
        let FONT_INTERNAL_NAME = '';

        const currentAppLanguage = language; 
        const currentCurrencySymbol = language === Language.LO ? t('currencyKip') : t('currencyBaht');


        const formatCurrencyForPdf = (value: number) => { 
            return value.toLocaleString(currentAppLanguage === Language.LO ? 'lo-LA' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
    
        const formatDateForPdf = (isoDate: string | undefined) => {
          if (!isoDate) return '-';
          return new Date(isoDate).toLocaleDateString(currentAppLanguage === Language.LO ? 'lo-LA' : 'th-TH', {
              year: 'numeric', month: 'short', day: 'numeric'
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
        let y = 10;
        const lineSpacing = 4;
        const smallFontSize = 7;
        const regularFontSize = 8;
        const headingFontSize = 12;

        // Header (Store Info Left, Report Title Right)
        let currentInfoY = y;
        const infoX = leftMargin;
        const infoMaxWidth = pageWidth * 0.5; // Max width for store info

        if (storeSettings.logoUrl) {
            const logoWidthMM = 15; 
            const maxLogoHeightMM = 10;
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
                        currentInfoY += actualLogoHeight + 1; 
                        resolve();
                    };
                    img.onerror = () => { resolve(); };
                    img.src = storeSettings.logoUrl;
                });
            } catch (e) { console.error("Error adding logo to PDF", e); }
        }
        
        doc.setFont(FONT_NAME, 'bold');
        doc.setFontSize(regularFontSize);
        doc.text(storeSettings.storeName, infoX, currentInfoY, { maxWidth: infoMaxWidth });
        currentInfoY += doc.getTextDimensions(storeSettings.storeName, {fontSize: regularFontSize, maxWidth: infoMaxWidth}).h + 1;

        doc.setFont(FONT_NAME, 'normal');
        doc.setFontSize(smallFontSize);
        doc.text(storeSettings.address, infoX, currentInfoY, { maxWidth: infoMaxWidth });
        currentInfoY += doc.getTextDimensions(storeSettings.address, {fontSize: smallFontSize, maxWidth: infoMaxWidth}).h + 1;
        doc.text(`${t('phoneLabel')}: ${storeSettings.phone}`, infoX, currentInfoY, { maxWidth: infoMaxWidth });
        currentInfoY += lineSpacing;

        const leftBlockBottomY = currentInfoY;

        // Report Title (Right)
        doc.setFont(FONT_NAME, 'bold');
        doc.setFontSize(headingFontSize);
        const reportTitle = t('creditTrackingPageTitle');
        const titleWidth = doc.getTextWidth(reportTitle);
        doc.text(reportTitle, pageWidth - rightMargin - titleWidth, y + 5);
        
        y = Math.max(leftBlockBottomY, y + 5 + (headingFontSize * 0.35)) + 5; 


        doc.setFontSize(10);
        const tableColumn = [t('idx'), t('customerName'), t('phone'), t('openInvoices'), t('totalOutstanding'), t('earliestDueDate'), t('status')];
        const tableRows: (string | number)[][] = [];

        filteredSummaries.forEach((item, index) => {
            const rowData = [
                index + 1,
                item.customerName,
                item.customerPhone || '-',
                item.openInvoicesCount,
                `${formatCurrencyForPdf(item.totalOutstandingAmount)} ${currentCurrencySymbol}`,
                formatDateForPdf(item.earliestDueDate),
                t(`status${item.overallStatus.charAt(0).toUpperCase() + item.overallStatus.slice(1)}`)
            ];
            tableRows.push(rowData);
        });

        (doc as any).autoTable({ 
            head: [tableColumn],
            body: tableRows,
            startY: y,
            theme: 'grid',
            headStyles: { fillColor: UI_COLORS.primary.replace('#',''), font: FONT_NAME, textColor: '#FFFFFF' }, 
            styles: { font: FONT_NAME, fontSize: 8 },
            didParseCell: function (data: any) { 
                if (data.cell.section === 'head' || data.cell.section === 'body') {
                     data.cell.styles.font = FONT_NAME;
                }
            }
        });
        doc.save(`${t('creditTrackingPageTitle')}_${new Date().toISOString().split('T')[0]}.pdf`);
     } catch (err) {
         console.error("Error generating PDF:", err);
         Swal.fire(t('error'), t('pdfLibraryNotLoaded'), 'error');
     }
  };


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-700">{t('creditTrackingPageTitle')}</h1>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <Input label={t('search')} placeholder={t('searchCustomerPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} wrapperClassName="mb-0"/>
          <div className="grid grid-cols-2 gap-2">
            <Input label={t('dueDate') + ' (' + t('from') +')'} type="date" value={filterDueDateFrom} onChange={e => setFilterDueDateFrom(e.target.value)} wrapperClassName="mb-0"/>
            <Input label={t('dueDate') + ' (' + t('to') +')'} type="date" value={filterDueDateTo} onChange={e => setFilterDueDateTo(e.target.value)} wrapperClassName="mb-0"/>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
            <select id="statusFilter" value={filterStatus} onChange={e => setFilterStatus(e.target.value as CreditInvoiceStatus | 'all')}
              className="mt-1 block w-full px-3 py-2.5 h-11 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            >
              <option value="all">{t('all')}</option>
              <option value="unpaid">{t('statusUnpaid')}</option>
              <option value="due_soon">{t('statusDueSoon')}</option>
              <option value="overdue">{t('statusOverdue')}</option>
              <option value="pending">{t('statusPending')}</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end space-x-2">
            <Button onClick={exportToExcel} variant="outline" size="sm" leftIcon={<ExcelIcon className="mr-1"/>}>{t('exportToExcel')}</Button>
            <Button onClick={exportToPDF} variant="outline" size="sm" leftIcon={<PDFIcon className="mr-1"/>}>{t('exportToPDF')}</Button>
        </div>
      </Card>

      {isLoading ? (
        <LoadingSpinner text={t('loading')} />
      ) : (
        <div className="bg-white shadow-xl rounded-lg overflow-auto h-[calc(100vh-21rem)]">
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('idx')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('customerName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('phone')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('openInvoices')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('totalOutstanding')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('earliestDueDate')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('status')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSummaries.map((summary, index) => (
                <tr key={summary.customerId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{index + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{summary.customerName}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{summary.customerPhone || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">{summary.openInvoicesCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-red-600">{formatCurrency(summary.totalOutstandingAmount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(summary.earliestDueDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${getStatusColor(summary.overallStatus)}`}>
                        {t(`status${summary.overallStatus.charAt(0).toUpperCase() + summary.overallStatus.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(summary)} className="text-purple-600 hover:text-purple-900" title={t('viewDetails')}>
                      <ViewIcon />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredSummaries.length === 0 && !isLoading && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-500">{t('noDataFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isDetailModalOpen && selectedCustomerForDetail && (
        <CustomerCreditDetailModal 
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            customerSummary={selectedCustomerForDetail}
            allSales={allSales}
            onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
};