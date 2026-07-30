

export type UserProfile = {
    id: string; // Same as auth uid
    email: string;
    shopId: string;
    role: 'owner' | 'staff' | 'admin';
    shopName: string; // Denormalized for easy display
    shopNumber?: string;
}

export type Shop = {
    id: string;
    name: string;
    ownerId: string; // The uid of the user who owns the shop
    createdAt: string; // ISO date string
    shopNumber?: string;
    address?: string;
    phone?: string;
    logoURL?: string;
    prefix?: string;
}

export type Customer = {
    id: string;
    shopId: string;
    name: string;
    fatherName?: string;
    mobileNumber: string;
    alternateMobile?: string;
    address: string;
    idProofType: 'Aadhar' | 'PAN' | 'Driving Licence' | 'Others';
    idProofNumber: string;
    idProofPhotoUrl: string; // Changed from optional to required
    reference?: string;
    photoUrl: string; // Changed from optional to required
    notes?: string;
    createdAt?: string; // ISO string for sorting
}

export type PledgeItem = {
    metalType: 'Gold' | 'Silver';
    type: string;
    quantity: number;
    totalWeight: number;
    stoneWeight?: number;
    netWeight: number;
    purity: number;
    estimatedValue: number;
    ratePerGram?: number;
};

export type bankCoverage = {
    bankName: string;
    bankLoanAmount: number;
    depositDate: string;
    scheme?: string;
    duration?: string;
    status: 'In Bank' | 'Released';
};

export type Pledge = {
    id: string;
    shopId: string;
    customerId: string;
    customerName: string; // Denormalized
    schemeId?: string;
    schemeName?: string;
    interestTiers?: InterestTier[];
    overdueInterestRate?: number;
    items: PledgeItem[];
    totalWeight: number;
    estimatedValue: number;
    loanAmount: number;
    documentCharges?: number;
    interestRate: number; // Annual interest rate in percent
    loanDuration: number;
    loanDurationType: string;
    createdAt: string; // This is the Loan Date
    dueDate: string; // This is the Closing Date
    status: 'ACTIVE' | 'OVERDUE' | 'CLOSED';
    paidAmount: number; // total principal paid
    interestPaid: number; // total interest paid
    notes?: string;
    itemImageUrl?: string;
    bankCoverage?: bankCoverage;
};

export type BankPledgeGroup = {
    id: string;
    shopId: string;
    bankName: string;
    bankLoanAmount: number;
    depositDate: string;
    scheme?: string;
    duration?: string;
    status: 'In Bank' | 'Released';
    pledgeIds: string[];
    appraisalFees?: number;
    authorisedPerson?: string;
    bankInterestRate?: number;
    createdAt: string;
};

export type Payment = {
    id: string;
    shopId: string;
    pledgeId: string;
    paymentType: 'Interest' | 'Partial' | 'Settlement';
    amount: number;
    paymentDate: string; // ISO string
    adjustment?: number; // For discounts or round-ups
    lateFee?: number;
    newDueDate?: string; // ISO string
};

export type InterestTier = {
    duration: number;
    rate: number; // The interest rate for this tier
};

export type Scheme = {
    id: string;
    shopId: string;
    name: string;
    interestTiers: InterestTier[]; // Replaces single duration/rate
    durationType: 'Days' | 'Months' | 'Years'; // Overall duration type
    advanceInterest: boolean;
    overdueInterestRate: number; // Rate after all tiers are complete
    maximumEligibility: number;
    ratePerGram: number;
}

export type ItemType = {
    id: string; // e.g., Gold_{shopId}
    shopId: string;
    metalType: 'Gold' | 'Silver';
    types: string[];
}

export type Counter = {
    // The ID will be something like `pledge_{shopId}`
    lastId: number;
}
