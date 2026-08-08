
"use client";
import React from 'react';
import { Pledge, Customer, Shop, UserProfile, Scheme } from '@/lib/types';
import Image from 'next/image';
import numberToWords from 'number-to-words';

interface PledgeVoucherProps {
    pledge?: Pledge | null;
    customer?: Customer | null;
    shop?: Shop | null;
}

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
);

const formatIndianCurrency = (num: number) => {
    if (typeof num !== 'number') {
        return '0';
    }
    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
    }).format(Math.round(num));
};


export const PledgeVoucher = React.forwardRef<HTMLDivElement, PledgeVoucherProps>((props, ref) => {
    const { pledge, customer, shop } = props;

    if (!pledge || !customer || !shop) {
        return <div ref={ref} className="p-8 text-center text-red-500">Missing data to generate voucher.</div>;
    }

    const emptyRowsCount = Math.max(0, 8 - pledge.items.length);
    const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => i);


    const totalQuantity = pledge.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalGrossWeight = pledge.items.reduce((sum, item) => sum + (Number(item.totalWeight) || 0), 0);
    const totalStoneWeight = pledge.items.reduce((sum, item) => sum + (Number(item.stoneWeight) || 0), 0);
    const totalNetWeight = pledge.items.reduce((sum, item) => sum + (Number(item.netWeight) || 0), 0);

    const dateOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };


    const renderVoucherHalf = (key: string) => (
        <div key={key} className="p-4 border border-black space-y-2 flex flex-col flex-grow">
            {/* Header */}
            <div className="text-center">
                 <div className="font-bold text-2xl">
                    உ
                </div>
                 {shop.logoURL && <Image src={shop.logoURL} alt="logo" width={60} height={60} className="mx-auto" />}
                    <h1 className="font-bold text-6xl text-destructive mt-2">ஸ்ரீ லெக்ஷ்மி & கோ</h1>
                <p className="pt-2.5 text-3xl">{shop.address}</p>
                <p className="text-2xl font-bold">{shop.phone}</p>
                
            </div>
            
            <div className="flex justify-between items-start">
                <div className="w-1/2 space-y-1">
                    <p className="font-bold">
                        <span className="text-2xl">Loan Amount :</span> <span className="text-3xl">₹ {pledge.loanAmount}</span>
                    </p>
                    <p className="font-bold">
                        <span className="text-2xl">Loan No : </span><span className="text-3xl">{pledge.id}</span>
                    </p>
                </div>
                <div className="w-1/2 text-right space-y-1">
                    <p className="font-bold">
                        <span className="text-xl">Date : </span> <span className="text-2xl">{new Date(pledge.createdAt).toLocaleDateString('en-IN', dateOptions)}</span>
                    </p>
                    <p className="font-bold">
                        <span className="text-2xl">Due Date : </span> <span className="text-2xl">{new Date(pledge.dueDate).toLocaleDateString('en-IN', dateOptions)}</span>
                    </p>
                </div>
            </div>

            {/* Scheme Name */}
            <div className="text-center border border-black py-1">
                <p className="font-bold mt-2 text-2xl">{pledge.schemeName || `${pledge.loanDuration} ${pledge.loanDurationType} @ ${pledge.interestRate}%`}</p>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                    <p className="font-bold text-2xl">{customer.name}</p>
                    <p className="text-2xl">{customer.fatherName}</p>
                    <p className="text-2xl">{customer.address}</p>
                    <p className="text-2xl font-bold">{customer.mobileNumber}</p>
                    <p className="font-bold">Loan Amount in words : Rupees {numberToWords.toWords(pledge.loanAmount)} only</p>
                </div>
                <div className="col-span-1 flex items-start justify-end gap-2">
  {customer.photoUrl ? (
    <Image
      src={customer.photoUrl}
      alt="Customer"
      width={150}
      height={180}
      className="h-[180px] w-[150px] object-cover border border-black"
    />
  ) : (
    <div className="h-[180px] w-[150px] border border-black flex items-center justify-center">
      No Customer Photo
    </div>
  )}

  {pledge.itemImageUrl ? (
    <Image
      src={pledge.itemImageUrl}
      alt="Pledged Item"
      width={150}
      height={180}
      className="h-[180px] w-[150px] object-cover border border-black"
    />
  ) : (
    <div className="h-[180px] w-[150px] border border-black flex items-center justify-center">
      No Item Photo
    </div>
  )}
</div>
            </div>

            {/* Items Table */}
            <div className="border border-black">
                <table className="w-full text-2xl">
                    <thead>
                        <tr className="border-b border-black font-bold">
                            <td className="p-1 border-r border-black w-2/5">Item Details</td>
                            <td className="p-1 border-r border-black text-center">Qty</td>
                            <td className="p-1 border-r border-black text-center">Total Wt.</td>
                            <td className="p-1 border-r border-black text-center">Stone Wt.</td>
                            <td className="p-1 text-center">Net Wt.</td>
                        </tr>
                    </thead>
                    <tbody>
                       {pledge.items.map((item, index) => (
                            <tr key={`item-${index}`}>
                                <td className="p-1 border-r border-black">{item.type}</td>
                                <td className="p-1 border-r border-black text-center">{item.quantity}</td>
                                <td className="p-1 border-r border-black text-center">{(Number(item.totalWeight) || 0).toFixed(2)}</td>
                                <td className="p-1 border-r border-black text-center">{(Number(item.stoneWeight) || 0).toFixed(2)}</td>
                                <td className="p-1 text-center">{(Number(item.netWeight) || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                        {emptyRows.map((_, index) => (
                           <tr key={`empty-${index}`} style={{ height: '24px' }}>
                                <td className="p-1 border-r border-black">&nbsp;</td>
                                <td className="p-1 border-r border-black"></td>
                                <td className="p-1 border-r border-black"></td>
                                <td className="p-1 border-r border-black"></td>
                                <td className="p-1"></td>
                           </tr>
                        ))}
                    </tbody>
                     <tfoot>
                        <tr className="border-t border-black font-bold">
                            <td className="p-1 border-r border-black">Total</td>
                            <td className="p-1 border-r border-black text-center">{totalQuantity}</td>
                            <td className="p-1 border-r border-black text-center">{totalGrossWeight.toFixed(2)}</td>
                            <td className="p-1 border-r border-black text-center">{totalStoneWeight.toFixed(2)}</td>
                            <td className="p-1 text-center">{totalNetWeight.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-2">
                 <p className="font-bold">
                    <span className="text-2xl">Estimated Value:</span> <span className="text-3xl">₹ {formatIndianCurrency(pledge.estimatedValue)}</span>
                </p>
            </div>
            
            {/* T&C */}
            <div className="text-lg">
                <h2 className="font-bold">வேலை நேரம்: 9:00 AM to 9:00 PM | விடுமுறை: ஞாயிற்றுக்கிழமை மற்றும் முக்கிய பண்டிகை நாட்கள்.</h2>
                <h2 className="font-bold">மேற்கண்ட திட்டத்தின்ப்டி அடகு வைக்க சம்மதிக்கிறேன். நான் ஒப்புகொண்ட காலகெடுவுக்குள் நகையை மீட்க தவறும்பட்சத்தில் நிர்வாகம் எடுக்கும் நடவடிக்கைக்கு என் தரப்பில் எந்தவித சட்ட நடவடிக்கையும் மேற்கொள்ளமாட்டேன் என்று என் சுயநினைவுடன் சம்மதம் தெரிவிக்கிறேன்.</h2>
            </div>

             {/* Footer */}
            <div className="flex justify-between items-end pt-16 mt-auto">
                <p className="text-lg">சம்மதம் தெரிவித்து கையொப்பம் (அ) கைரேகை</p>
                <div className="text-center">
                  <p className="font-bold">For ஸ்ரீ லெக்ஷ்மி & கோ</p>
                </div>
            </div>
        </div>
    );
    
    const renderSlipHalf = (key: string) => (
        <div key={key} className="p-2 flex flex-col space-y-1 text-4xl justify-center">
            <b>Loan No: {pledge.id}</b>
            <div>
                <div><b>{customer.name}</b></div>
                <div><b>{customer.mobileNumber}</b></div>
            </div>
            <span>{pledge.schemeName || `${pledge.loanDuration} Month ${pledge.interestRate}`}</span>
            <div>
                {pledge.items.map((item, index) => (
                    <span key={index} className="block">{item.type} - {item.quantity}</span>
                ))}
            </div>
            <span>Total Wt: {totalGrossWeight.toFixed(2)}</span>
            <span>Net Wt: {totalNetWeight.toFixed(2)}</span>
            <span><b>Amount: ₹{pledge.loanAmount}</b></span>
            <span>Loan Date: {new Date(pledge.createdAt).toLocaleDateString("en-IN", dateOptions)}</span>
        </div>
    );
      
    return (
        <div ref={ref} className="bg-white text-black font-sans p-8">
            <div className="flex flex-col">
                {renderVoucherHalf('top')}
                <hr className="border-t-2 border-dashed border-gray-400 my-8" />
                {renderVoucherHalf('bottom')}
            </div>

            <div className="mt-4 flex justify-end pr-16 gap-x-96">
                <div className="origin-bottom-left -rotate-90">
                    {renderSlipHalf('slip-1')}
                </div>
                <div className="origin-bottom-left -rotate-90">
                    {renderSlipHalf('slip-2')}
                </div>
            </div>
        </div>
    );
});

PledgeVoucher.displayName = 'PledgeVoucher';

  

    