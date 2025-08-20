import React, { useState, useEffect, useCallback } from 'react';
import { ExchangeRates } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getExchangeRates, saveExchangeRates } from '../../services/firebaseService';
import Input from '../common/Input';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';

declare var Swal: any;

const ExchangeRatePage: React.FC = () => {
  const { t } = useLanguage();
  const [rates, setRates] = useState<Partial<Omit<ExchangeRates, 'updatedAt'>>>({ thb: 0, usd: 0, cny: 0, vatRate: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchRates = async () => {
      setIsLoading(true);
      try {
        const fetchedRates = await getExchangeRates();
        if (fetchedRates) {
          setRates({
            thb: fetchedRates.thb || 0,
            usd: fetchedRates.usd || 0,
            cny: fetchedRates.cny || 0,
            vatRate: fetchedRates.vatRate ?? 0,
          });
        }
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRates();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRates(prev => ({ ...prev, [name]: value === '' ? '' : value }));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ratesToSave = {
        thb: parseFloat(String(rates.thb)) || 0,
        usd: parseFloat(String(rates.usd)) || 0,
        cny: parseFloat(String(rates.cny)) || 0,
        vatRate: parseFloat(String(rates.vatRate)) || 0,
      };
      await saveExchangeRates(ratesToSave);
      Swal.fire({
        icon: 'success',
        title: t('exchangeRatesSavedSuccess'),
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("Error saving exchange rates:", error);
      Swal.fire(t('error'), t('errorSavingExchangeRates'), 'error');
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading) {
    return <div className="p-6 flex justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="p-4 md:p-6 flex justify-center items-start">
      <Card title={t('exchangeRateSettings')} className="w-full max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <Input
            label={t('vatRateLabel')}
            name="vatRate"
            type="number"
            step="0.01"
            value={rates.vatRate ?? 0}
            onChange={handleChange}
          />
          <hr/>
          <p className="text-sm font-semibold pt-2">{t('baseCurrencyLabel')}</p>
          <Input
            label={t('thbLabel')}
            name="thb"
            type="text"
            value={rates.thb}
            onChange={handleChange}
          />
          <Input
            label={t('usdLabel')}
            name="usd"
            type="text"
            value={rates.usd}
            onChange={handleChange}
          />
          <Input
            label={t('cnyLabel')}
            name="cny"
            type="text"
            value={rates.cny}
            onChange={handleChange}
          />
          <div className="pt-4 flex justify-end">
            <Button type="submit" variant="primary" isLoading={isSaving} className="bg-red-600 hover:bg-red-700">
              {t('saveExchangeRatesButton')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ExchangeRatePage;