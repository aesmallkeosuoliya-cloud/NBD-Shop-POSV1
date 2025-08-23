import React, { useState, useEffect, useCallback } from 'react';
import { StoreSettings, Language, Translations } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getStoreSettings, saveStoreSettings, isFirebaseInitialized } from '../../services/firebaseService';
import { DEFAULT_STORE_SETTINGS } from '../../constants';
import Input from '../common/Input';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';

declare var Swal: any; // SweetAlert2

const StoreSettingsPage: React.FC = () => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    if (!isFirebaseInitialized()) {
      console.warn("Firebase not ready for fetching store settings.");
      setSettings(DEFAULT_STORE_SETTINGS);
      setInitialSettings(DEFAULT_STORE_SETTINGS);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedSettings = await getStoreSettings();
      const activeSettings = fetchedSettings || DEFAULT_STORE_SETTINGS;
      setSettings(activeSettings);
      setInitialSettings(activeSettings);
    } catch (error) {
      console.error(t('errorLoadingStoreSettings'), error);
      Swal.fire(t('error'), t('errorLoadingStoreSettings'), 'error');
      setSettings(DEFAULT_STORE_SETTINGS);
      setInitialSettings(DEFAULT_STORE_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value as any }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            Swal.fire(t('error'), t('invalidFileType'), 'error');
            event.target.value = ''; 
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.onerror = () => {
            console.error(t('errorReadingFile'));
            Swal.fire(t('error'), t('errorReadingFile'), 'error');
        };
        reader.readAsDataURL(file);
    }
  };

  const handleQrFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            Swal.fire(t('error'), t('invalidFileType'), 'error');
            event.target.value = ''; 
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings(prev => ({ ...prev, qrPaymentUrl: reader.result as string }));
        };
        reader.onerror = () => {
            console.error(t('errorReadingFile'));
            Swal.fire(t('error'), t('errorReadingFile'), 'error');
        };
        reader.readAsDataURL(file);
    }
  };


  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!settings.storeName?.trim()) newErrors.storeName = t('requiredField');
    if (!settings.address?.trim()) newErrors.address = t('requiredField');
    if (!settings.phone?.trim()) newErrors.phone = t('requiredField');
    if (!settings.footerNote?.trim()) newErrors.footerNote = t('requiredField');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveSettings = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await saveStoreSettings(settings);
      Swal.fire(t('success'), t('storeSettingsSaved'), 'success');
      setInitialSettings(settings); 

    } catch (error) {
      console.error(t('errorSavingStoreSettings'), error);
      Swal.fire(t('error'), t('errorSavingStoreSettings'), 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const previewFontClass = 'font-["Noto_Sans_Lao"]';
  
  const dynamicReceiptHeading = t('receiptSaleHeading');


  if (isLoading) {
    return <div className="p-6 flex justify-center items-center h-[calc(100vh-8rem)]"><LoadingSpinner text={t('loading')} /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800">{t('storeSettingsPageTitle')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card title={t('storeInfoGroup')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('storeNameLabel')} name="storeName" value={settings.storeName} onChange={handleChange} placeholder={t('storeNamePlaceholder')} error={errors.storeName} required className="text-base text-gray-900"/>
              <Input label={t('addressLabel')} name="address" value={settings.address} onChange={handleChange} placeholder={t('addressPlaceholder')} error={errors.address} required className="text-base text-gray-900"/>
              <Input label={t('phoneLabel')} name="phone" value={settings.phone} onChange={handleChange} placeholder={t('phonePlaceholder')} error={errors.phone} required className="text-base text-gray-900"/>
              <Input label={t('taxIdLabel')} name="taxId" value={settings.taxId} onChange={handleChange} placeholder={t('taxIdPlaceholder')} error={errors.taxId} className="text-base text-gray-900"/>
              
              <div className="md:col-span-1">
                <label htmlFor="logoUpload" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('uploadLogoLabel')}
                </label>
                <input
                    type="file"
                    id="logoUpload"
                    name="logoUpload"
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                />
                {settings.logoUrl && (
                    <div className="mt-3 p-2 border rounded-md inline-block bg-slate-50">
                        <img
                            src={settings.logoUrl}
                            alt={t('altLogoStore')}
                            className="max-h-24 mx-auto object-contain"
                        />
                    </div>
                )}
                 <p className="mt-1 text-xs text-gray-500">{t('logoPreviewMessage')}</p>
              </div>

               <div className="md:col-span-1">
                <label htmlFor="qrUpload" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('uploadQrLabel')}
                </label>
                <input
                    type="file"
                    id="qrUpload"
                    name="qrUpload"
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                    onChange={handleQrFileChange}
                    className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-gray-50 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                />
                {settings.qrPaymentUrl && (
                    <div className="mt-3 p-2 border rounded-md inline-block bg-slate-50">
                        <img
                            src={settings.qrPaymentUrl}
                            alt={t('altQrPayment')}
                            className="max-h-24 mx-auto object-contain"
                        />
                    </div>
                )}
                 <p className="mt-1 text-xs text-gray-500">{t('qrPaymentPreview')}</p>
              </div>

            </div>
          </Card>

          <Card title={t('receiptFooterGroup')}>
            <div>
              <label htmlFor="footerNote" className="block text-sm font-medium text-gray-700 mb-1">{t('footerNoteLabel')}</label>
              <textarea id="footerNote" name="footerNote" rows={3} value={settings.footerNote} onChange={handleChange} placeholder={t('footerNotePlaceholder')} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-base text-gray-900" />
              {errors.footerNote && <p className="mt-1 text-xs text-red-600">{errors.footerNote}</p>}
            </div>
          </Card>

          <Card title={t('appDefaultsGroup')}>
            <div>
              <label htmlFor="defaultLanguage" className="block text-sm font-medium text-gray-700 mb-1">{t('defaultLanguageLabel')}</label>
              <Input id="defaultLanguage" name="defaultLanguage" value={t('lao')} readOnly disabled className="mt-1 block w-full md:w-1/2 bg-gray-100 cursor-not-allowed"/>
            </div>
          </Card>
          
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveSettings} variant="primary" size="lg" isLoading={isSaving} className="text-base py-3">
              {t('saveSettingsButton')}
            </Button>
          </div>
        </div>

        {/* Receipt Preview Section */}
        <div className="lg:col-span-1">
          <Card title={t('receiptPreviewGroup')} bodyClassName="space-y-4 sticky top-20">
            <div className={`p-3 border rounded-md shadow-sm bg-white text-xs break-words min-h-[400px] max-w-[300px] mx-auto text-black ${previewFontClass}`}>
              <div className="flex justify-between items-start mb-2">
                  <div className="flex-grow basis-3/5 pr-1"> 
                      {settings.logoUrl && (
                          <img 
                              src={settings.logoUrl} 
                              alt={t('logoPreviewAlt')} 
                              className="max-w-[60px] max-h-[30px] mb-1 object-contain" 
                          />
                      )}
                      <div className="font-semibold text-sm leading-tight">{settings.storeName || `[${t('receiptHeaderStoreName')}]`}</div>
                      <div className="text-[9px] leading-snug">{settings.address || `[${t('receiptHeaderAddress')}]`}</div>
                      <div className="text-[9px] leading-snug">{t('receiptHeaderPhone')}: {settings.phone || '[020-XXX-XXXX]'}</div>
                      {settings.taxId && <div className="text-[9px] leading-snug">{t('receiptHeaderTaxId')}: {settings.taxId}</div>}
                  </div>
                  
                  <div className="font-bold text-base text-right flex-shrink-0 basis-2/5 pt-0.5">
                      {dynamicReceiptHeading}
                  </div>
              </div>
              
              <div className={`border-t border-b border-dashed border-gray-400 my-1.5 py-1`}>
                <div className="flex justify-between"><span>{t('receiptItemPlaceholder')} 1 x 2</span><span>200.00</span></div>
                <div className="flex justify-between"><span>{t('receiptItemPlaceholder')} 2 x 1</span><span>150.00</span></div>
              </div>
              <div className={`text-right font-semibold my-1`}>{t('receiptTotalLabel')}: 350.00</div>
              <div className={`border-t border-dashed border-gray-400 mt-1.5 pt-1.5 text-center text-[10px] leading-tight`}>
                {settings.footerNote || `[${t('receiptFooterText')}]`}
              </div>
               {settings.qrPaymentUrl && (
                    <div className="mt-3 text-center">
                        <img
                            src={settings.qrPaymentUrl}
                            alt={t('altQrPayment')}
                            className="max-w-[100px] mx-auto object-contain"
                        />
                    </div>
                )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StoreSettingsPage;