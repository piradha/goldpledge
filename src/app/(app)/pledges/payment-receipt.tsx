
"use client";
import React from 'react';
import { Pledge, Customer, Shop, Payment } from '@/lib/types';
import { calculateInterest } from '@/lib/interest';
import Image from 'next/image';

interface PaymentReceiptProps {
    payment: Payment;
    pledge: Pledge;
    customer: Customer;
    shop: Shop;
    allPayments?: Payment[];
}

const formatIndianCurrency = (num: number) => {
    if (typeof num !== 'number') {
        return '0';
    }
    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
    }).format(num);
};

export const PaymentReceipt = React.forwardRef<HTMLDivElement, PaymentReceiptProps>((props, ref) => {
    const { payment, pledge, customer, shop, allPayments } = props;

    if (!payment || !pledge || !customer || !shop) {
        return <div ref={ref} className="p-8 text-center text-red-500">Missing data to generate receipt.</div>;
    }

    const { interestDue: interestAfterPayment } = calculateInterest(pledge, null, new Date(payment.paymentDate), allPayments || []);
    const outstandingPrincipalAfterPayment = (Number(pledge.loanAmount) || 0) - (Number(pledge.paidAmount) || 0);
    const totalOutstandingAfterPayment = outstandingPrincipalAfterPayment + interestAfterPayment;

    const renderReceiptHalf = (key: string) => (
         <div key={key} className="p-6 border-2 border-dashed border-black space-y-4 text-sm">
            {/* Header */}
            <div className="text-center">
                 {shop.logoURL && <Image src={shop.logoURL} alt="logo" width={60} height={60} className="mx-auto" />}
                <h1 className="font-bold text-xl">{shop.name}</h1>
                <p className="text-sm">{shop.address}</p>
                <p className="text-xs">{shop.phone}</p>
            </div>
            
            <div className="text-center font-bold border-y border-black py-1">
                PAYMENT RECEIPT
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="font-medium">Receipt No:</span><span>{payment.id.slice(-6).toUpperCase()}</span>
                <span className="font-medium">Payment Date:</span><span>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</span>
                <span className="font-medium">Pledge ID:</span><span>{pledge.id}</span>
                <span className="font-medium">Pledge Date:</span><span>{new Date(pledge.createdAt).toLocaleDateString('en-IN')}</span>
                <span className="font-medium">Customer:</span><span>{customer.name}</span>
                 <span className="font-medium">Address:</span><span>{customer.address}</span>
            </div>

            <hr className="border-dashed" />
            
            {/* Payment Details */}
            <div className="space-y-2">
                 <div className="flex justify-between items-center text-base">
                    <span className="font-bold">Payment Type:</span>
                    <span className="font-bold">{payment.paymentType}</span>
                </div>
                 <div className="flex justify-between items-center text-2xl">
                    <span className="font-bold">AMOUNT PAID:</span>
                    <span className="font-bold">₹ {formatIndianCurrency(payment.amount)}</span>
                </div>
                 {payment.adjustment !== 0 && (
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Adjustment:</span>
                        <span>₹ {formatIndianCurrency(payment.adjustment || 0)}</span>
                    </div>
                )}
            </div>
            
             <hr className="border-dashed" />

            {/* Balance Details */}
             <div className="space-y-1 text-xs">
                <p className="font-bold mb-1">Balance after this payment:</p>
                <div className="flex justify-between">
                    <span>Outstanding Principal:</span>
                    <span>₹ {formatIndianCurrency(outstandingPrincipalAfterPayment)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Accrued Interest:</span>
                    <span>₹ {formatIndianCurrency(interestAfterPayment)}</span>
                </div>
                 <div className="flex justify-between font-bold text-sm mt-1">
                    <span>Total Outstanding:</span>
                    <span>₹ {formatIndianCurrency(totalOutstandingAfterPayment)}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-6">
                <p className="text-xs">Thank you for your payment!</p>
                <p className="text-xs">This is a computer-generated receipt.</p>
            </div>
        </div>
    );

    return (
        <div ref={ref} className="bg-white text-black font-sans p-4">
            <div className="grid grid-cols-2 gap-4">
                 {renderReceiptHalf('original')}
                 {renderReceiptHalf('duplicate')}
            </div>
        </div>
    );
});

PaymentReceipt.displayName = 'PaymentReceipt';
