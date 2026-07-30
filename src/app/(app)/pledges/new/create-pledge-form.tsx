
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Plus, Trash2, Printer, ImageIcon, Loader2, ChevronsUpDown, Check, SwitchCamera, CheckCircle } from "lucide-react";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirebase, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, doc, where } from "firebase/firestore";
import { Customer, Scheme, Pledge, PledgeItem, ItemType, UserProfile, Shop } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { addPledge, updatePledge } from "@/firebase/firestore/pledges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format, add, parse, isValid } from "date-fns";

/* ------------------------------------------------------------------ */
/* 🔑 KEYBOARD HELPERS (IMPORTANT)                                     */
/* ------------------------------------------------------------------ */
const focusNext = (ref?: HTMLElement | null, open = false) => {
    if (!ref) return;
    ref.focus();
    if (open) ref.click();
};

const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    next?: HTMLElement | null
) => {
    if (e.key === "Enter") {
        e.preventDefault();
        focusNext(next);
    }
};


function CustomerCombobox({ customers, value, onSelect, onCustomerSelect }: { customers: Customer[] | null, value: string, onSelect: (value: string) => void, onCustomerSelect: () => void }) {
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !value && "text-muted-foreground")}
                >
                    {value
                        ? customers?.find((customer) => customer.id === value)?.name
                        : "Select a customer"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command onKeyDown={(e) => {
                    if (e.key === 'Enter' && open) {
                        const selected = document.querySelector('[cmdk-item][aria-selected="true"]');
                        if (selected) {
                            e.preventDefault();
                            (selected as HTMLElement).click();
                        }
                    }
                }}>
                    <CommandInput placeholder="Search customer..." />
                    <CommandEmpty>No customer found.</CommandEmpty>
                    <CommandList>
                        {customers?.map((customer) => (
                            <CommandItem
                                key={customer.id}
                                value={`${customer.name} ${customer.mobileNumber}`}
                                onSelect={() => {
                                    onSelect(customer.id)
                                    setOpen(false)
                                    onCustomerSelect();
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === customer.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {customer.name} - {customer.mobileNumber}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function SchemeCombobox({ schemes, value, onSelect, onSchemeSelect, buttonRef }: { schemes: Scheme[] | null, value: string, onSelect: (value: string) => void, onSchemeSelect: () => void, buttonRef: React.Ref<HTMLButtonElement> }) {
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={buttonRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !value && "text-muted-foreground")}
                >
                    {value
                        ? schemes?.find((scheme) => scheme.id === value)?.name
                        : "Select a scheme to auto-fill details"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command onKeyDown={(e) => {
                    if (e.key === 'Enter' && open) {
                        const selected = document.querySelector('[cmdk-item][aria-selected="true"]');
                        if (selected) {
                            e.preventDefault();
                            (selected as HTMLElement).click();
                        }
                    }
                }}>
                    <CommandInput placeholder="Search scheme..." />
                    <CommandEmpty>No scheme found.</CommandEmpty>
                    <CommandList>
                        {schemes?.map((scheme) => (
                            <CommandItem
                                key={scheme.id}
                                value={scheme.name}
                                onSelect={() => {
                                    onSelect(scheme.id)
                                    setOpen(false)
                                    onSchemeSelect();
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === scheme.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {scheme.name}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function ItemTypeCombobox({ itemTypes, value, onSelect, onTypeSelect, buttonRef }: { itemTypes: string[] | undefined, value: string, onSelect: (value: string) => void, onTypeSelect: () => void, buttonRef: React.Ref<HTMLButtonElement> }) {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={buttonRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !value && "text-muted-foreground")}
                >
                    {value || "Select type"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command onKeyDown={(e) => {
                    if (e.key === 'Enter' && open) {
                        const selected = document.querySelector('[cmdk-item][aria-selected="true"]');
                        if (selected) {
                            e.preventDefault();
                            (selected as HTMLElement).click();
                        }
                    }
                }}>
                    <CommandInput placeholder="Search item type..." />
                    <CommandEmpty>No item type found.</CommandEmpty>
                    <CommandList>
                        {itemTypes?.map((type) => (
                            <CommandItem
                                key={type}
                                value={type}
                                onSelect={() => {
                                    onSelect(type);
                                    setOpen(false);
                                    setTimeout(() => onTypeSelect(), 0);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === type ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {type}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}


const pledgeItemSchema = z.object({
    metalType: z.enum(["Gold", "Silver"], { required_error: "Metal type is required." }),
    type: z.string().min(1, "Item type is required."),
    quantity: z.coerce.number().int().min(1, "Qty must be at least 1."),
    totalWeight: z.coerce.number().min(0.01, "Total Wt. must be positive."),
    stoneWeight: z.coerce.number().min(0, "Stone Wt. cannot be negative.").optional(),
    purity: z.coerce.number().min(1, "Purity is required.").max(100),
    ratePerGram: z.coerce.number().min(0, "Rate cannot be negative."),
}).superRefine((data, ctx) => {
    if (data.totalWeight <= (data.stoneWeight ?? 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Total Wt. must be greater than Stone Wt.",
            path: ['totalWeight'],
        });
    }
});


const formSchema = z.object({
    loanDate: z.string().refine((val) => isValid(parse(val, "dd-MM-yyyy", new Date())), {
        message: "Invalid date format. Use DD-MM-YYYY.",
    }),
    closingDate: z.string().refine((val) => isValid(parse(val, "dd-MM-yyyy", new Date())), {
        message: "Invalid date format. Use DD-MM-YYYY.",
    }),
    customerId: z.string().min(1, "Please select a customer."),
    schemeId: z.string().optional(),
    items: z.array(pledgeItemSchema).min(1, "At least one item is required."),
    loanAmount: z.coerce.number().min(1, "Loan amount is required."),
    documentCharges: z.coerce.number().min(0, "Document charges cannot be negative.").optional(),
    interestRate: z.coerce.number().min(0.1, "Interest rate must be positive.").max(100),
    loanDuration: z.coerce.number().int().min(1, "Loan duration is required."),
    loanDurationType: z.string().min(1, "Please select duration type"),
    notes: z.string().optional(),
    itemImageUrl: z.string().optional(),
});

const createFormValidationSchema = (totalEstimatedValue: number) => {
    return formSchema.refine(
        (data) => {
            if (totalEstimatedValue > 0) {
                return data.loanAmount <= totalEstimatedValue;
            }
            return true; // Skip validation if estimated value is 0
        },
        {
            message: `Loan amount cannot exceed estimated value of ₹${totalEstimatedValue.toLocaleString()}.`,
            path: ["loanAmount"],
        }
    );
};



export function CreatePledgeForm({ editId }: { editId?: string }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [photo, setPhoto] = useState<string | null>(null);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [lastPledgeId, setLastPledgeId] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Refs for keyboard navigation
    const loanDateRef = useRef<HTMLInputElement>(null);
    const closingDateRef = useRef<HTMLInputElement>(null);
    const schemeButtonRef = useRef<HTMLButtonElement>(null);
    const itemMetalTypeRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const itemTypeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const quantityInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const totalWeightInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const stoneWeightInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const purityInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const loanAmountInputRef = useRef<HTMLInputElement>(null);
    const docChargesInputRef = useRef<HTMLInputElement>(null);
    const interestRateInputRef = useRef<HTMLInputElement>(null);
    const loanDurationInputRef = useRef<HTMLInputElement>(null);
    const loanDurationTypeRef = useRef<HTMLButtonElement>(null);


    const userProfileQuery = useMemoFirebase(
        () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
        [firestore, user?.email]
    );
    const { data: userProfiles } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const shopRef = useMemoFirebase(
        () => (firestore && userProfile ? doc(firestore, 'shops', userProfile.shopId) : null),
        [firestore, userProfile]
    );
    const { data: shop } = useDoc<Shop>(shopRef);

    const userCustomersQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, 'customers'), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: customers } = useCollection<Customer>(userCustomersQuery);

    const userSchemesQuery = useMemoFirebase(
        () => (firestore && userProfile ? query(collection(firestore, "schemes"), where('shopId', '==', userProfile.shopId)) : null),
        [firestore, userProfile]
    );
    const { data: schemes } = useCollection<Scheme>(userSchemesQuery);

    const goldItemTypesRef = useMemoFirebase(() => (firestore && userProfile ? doc(firestore, 'itemTypes', `Gold_${userProfile.shopId}`) : null), [firestore, userProfile]);
    const { data: goldItemTypesDoc } = useDoc<Omit<ItemType, 'id'>>(goldItemTypesRef);
    const silverItemTypesRef = useMemoFirebase(() => (firestore && userProfile ? doc(firestore, 'itemTypes', `Silver_${userProfile.shopId}`) : null), [firestore, userProfile]);
    const { data: silverItemTypesDoc } = useDoc<Omit<ItemType, 'id'>>(silverItemTypesRef);

    const repledgeId = searchParams.get('repledgeId');
    const { data: sourcePledge } = useDoc<Pledge>(
        useMemoFirebase(() => (repledgeId && firestore) ? doc(firestore, 'pledges', repledgeId) : null, [repledgeId, firestore])
    );

    const { data: editPledge } = useDoc<Pledge>(
        useMemoFirebase(() => (editId && firestore) ? doc(firestore, 'pledges', editId) : null, [editId, firestore])
    );

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(createFormValidationSchema(0)), // Start with 0
        mode: 'onChange',
        defaultValues: {
            loanDate: format(new Date(), "dd-MM-yyyy"),
            closingDate: "",
            customerId: "",
            schemeId: "",
            items: [{ metalType: "Gold", type: "", quantity: 1, totalWeight: 0, stoneWeight: 0, purity: 91.6, ratePerGram: 0 }],
            loanAmount: 0,
            documentCharges: 0,
            interestRate: 0,
            loanDuration: 0,
            loanDurationType: "Months",
            notes: "",
            itemImageUrl: "",
        },
    });

    const { control, watch, setValue, getValues, trigger, formState, reset } = form;

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    const watchedCustomerId = watch("customerId");
    const watchedSchemeId = watch("schemeId");
    const watchedItems = watch('items');
    const watchedLoanAmount = watch('loanAmount');
    const watchedDocCharges = watch('documentCharges');
    const watchedInterestRate = watch('interestRate');
    const watchedLoanDate = watch("loanDate");

    // Effect to pre-fill form for repledge or edit
    useEffect(() => {
        if (sourcePledge && repledgeId) {
            const { items, customerId, schemeId, loanAmount, documentCharges, interestRate, loanDuration, loanDurationType, notes, itemImageUrl } = sourcePledge;
            reset({
                loanDate: format(new Date(), "dd-MM-yyyy"),
                closingDate: "", // Recalculate based on new date
                customerId,
                schemeId: schemeId || "",
                items: items.map(item => ({ ...item, stoneWeight: item.stoneWeight || 0 })), // ensure stoneWeight is a number
                loanAmount,
                documentCharges: documentCharges || 0,
                interestRate,
                loanDuration,
                loanDurationType,
                notes: `Repledge of ${repledgeId}. ${notes || ''}`,
                itemImageUrl: itemImageUrl || "",
            });
            if (itemImageUrl) {
                setPhoto(itemImageUrl);
            }
        } else if (editPledge && editId) {
            const { items, customerId, schemeId, loanAmount, documentCharges, interestRate, loanDuration, loanDurationType, notes, itemImageUrl, createdAt, dueDate } = editPledge;
            reset({
                loanDate: format(new Date(createdAt), "dd-MM-yyyy"),
                closingDate: format(new Date(dueDate), "dd-MM-yyyy"),
                customerId,
                schemeId: schemeId || "",
                items: items.map(item => ({ ...item, stoneWeight: item.stoneWeight || 0 })),
                loanAmount,
                documentCharges: documentCharges || 0,
                interestRate,
                loanDuration,
                loanDurationType,
                notes: notes || "",
                itemImageUrl: itemImageUrl || "",
            });
            if (itemImageUrl) {
                setPhoto(itemImageUrl);
            }
        }
    }, [sourcePledge, editPledge, reset, repledgeId, editId]);

    const selectedScheme = useMemo(() => {
        if (!watchedSchemeId || !schemes) return null;
        return schemes.find(s => s.id === watchedSchemeId);
    }, [watchedSchemeId, schemes]);

    const totalEstimatedValue = (watchedItems || []).reduce((total, item) => {
        const totalW = Number(item.totalWeight) || 0;
        const stoneW = Number(item.stoneWeight) || 0;
        const netW = totalW > stoneW ? totalW - stoneW : 0;

        const itemRate = Number(item.ratePerGram) || 0;
        const schemeRate = selectedScheme?.ratePerGram || 0;
        const effectiveRate = itemRate > 0 ? itemRate : schemeRate;
        const estimatedValue = netW * effectiveRate;
        return total + estimatedValue;
    }, 0);

    const oneMonthInterest = useMemo(() => {
        const loan = Number(watchedLoanAmount) || 0;
        const rate = Number(watchedInterestRate) || 0;
        return (loan * rate) / 100;
    }, [watchedLoanAmount, watchedInterestRate]);

    const finalSettlementAmount = useMemo(() => {
        const loan = Number(watchedLoanAmount) || 0;
        const charges = Number(watchedDocCharges) || 0;
        return loan - charges - oneMonthInterest;
    }, [watchedLoanAmount, watchedDocCharges, oneMonthInterest]);


    // Dynamically update the resolver when the estimated value changes
    useEffect(() => {
        form.trigger(); // Manually trigger validation
    }, [totalEstimatedValue, form]);

    useEffect(() => {
        const loanDate = parse(watchedLoanDate, "dd-MM-yyyy", new Date());

        if (selectedScheme && isValid(loanDate) && selectedScheme.interestTiers?.length > 0) {
            let closingDate: Date;
            const primaryTier = selectedScheme.interestTiers[0];
            const duration = primaryTier.duration;

            switch (selectedScheme.durationType) {
                case "Days":
                    closingDate = add(loanDate, { days: duration });
                    break;
                case "Months":
                    closingDate = add(loanDate, { months: duration });
                    break;
                case "Years":
                    closingDate = add(loanDate, { years: duration });
                    break;
                default:
                    closingDate = loanDate;
            }
            setValue("closingDate", format(closingDate, "dd-MM-yyyy"), { shouldValidate: true });

            setValue("interestRate", primaryTier.rate, { shouldValidate: true });
            setValue("loanDuration", primaryTier.duration, { shouldValidate: true });
            setValue("loanDurationType", selectedScheme.durationType, { shouldValidate: true });

            // Auto-fill rate per gram for all items
            const currentItems = getValues('items');
            currentItems.forEach((_, index) => {
                setValue(`items.${index}.ratePerGram`, selectedScheme.ratePerGram, { shouldValidate: true });
            });
        }
    }, [selectedScheme, watchedLoanDate, setValue, getValues]);

    const stopCamera = useCallback(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        if (showCamera) {
            const getCameraPermission = async () => {
                stopCamera();
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                    setHasCameraPermission(true);
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (error) {
                    console.error('Error accessing camera:', error);
                    setHasCameraPermission(false);
                    toast({
                        variant: "destructive",
                        title: 'Camera Access Denied',
                        description: 'Please enable camera permissions in your browser settings to use this app.',
                    });
                    setShowCamera(false);
                }
            };
            getCameraPermission();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [showCamera, facingMode, stopCamera, toast]);

    const toggleFacingMode = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const takePicture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/png');
                setPhoto(dataUrl);
                form.setValue("itemImageUrl", dataUrl);
                setShowCamera(false);
            }
        }
    };

    const getPledgeDataFromForm = (): Omit<Pledge, 'id' | 'status' | 'paidAmount'> | null => {
        const values = getValues();
        const customer = customers?.find(c => c.id === values.customerId);
        if (!customer || !userProfile) return null;

        const parsedLoanDate = parse(values.loanDate, "dd-MM-yyyy", new Date());
        if (!isValid(parsedLoanDate)) return null;

        const parsedClosingDate = parse(values.closingDate, "dd-MM-yyyy", new Date());
        if (!isValid(parsedClosingDate)) return null;

        const pledgeItems: PledgeItem[] = values.items.map(item => {
            const total = Number(item.totalWeight) || 0;
            const stone = Number(item.stoneWeight) || 0;
            const net = total > stone ? total - stone : 0;

            const itemRate = Number(item.ratePerGram) || 0;
            const schemeRate = selectedScheme?.ratePerGram || 0;
            const effectiveRate = itemRate > 0 ? itemRate : schemeRate;
            const estimatedValue = net * effectiveRate;

            return {
                metalType: item.metalType,
                type: item.type,
                quantity: item.quantity,
                totalWeight: item.totalWeight,
                stoneWeight: item.stoneWeight,
                netWeight: net,
                purity: item.purity,
                estimatedValue: estimatedValue,
            }
        });

        const totalEstimatedValueFromItems = pledgeItems.reduce((sum, item) => {
            const itemValue = item.estimatedValue || 0;
            return sum + itemValue;
        }, 0);

        const totalNetWeightForAllItems = pledgeItems.reduce((sum, item) => {
            return sum + (item.netWeight || 0);
        }, 0);


        return {
            shopId: userProfile.shopId,
            customerName: customer.name,
            customerId: values.customerId,
            schemeId: values.schemeId || '',
            schemeName: selectedScheme?.name || '',
            interestTiers: selectedScheme ? (selectedScheme.interestTiers || []) : (sourcePledge?.interestTiers || editPledge?.interestTiers || []),
            overdueInterestRate: selectedScheme ? (selectedScheme.overdueInterestRate || 0) : (sourcePledge?.overdueInterestRate || editPledge?.overdueInterestRate || 0),
            items: pledgeItems,
            totalWeight: totalNetWeightForAllItems,
            estimatedValue: totalEstimatedValueFromItems,
            loanAmount: values.loanAmount,
            documentCharges: values.documentCharges || 0,
            interestRate: values.interestRate,
            loanDuration: values.loanDuration,
            loanDurationType: values.loanDurationType,
            createdAt: parsedLoanDate.toISOString(),
            dueDate: parsedClosingDate.toISOString(),
            notes: values.notes || '',
            itemImageUrl: values.itemImageUrl || '',
            interestPaid: editPledge?.interestPaid || 0,
        };
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        const finalValidationSchema = createFormValidationSchema(totalEstimatedValue);
        const validationResult = finalValidationSchema.safeParse(values);

        if (!validationResult.success) {
            const errorMessage = validationResult.error.issues[0]?.message || "Please check the form for errors.";
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: errorMessage
            });
            return;
        }

        if (!firestore || !userProfile) {
            toast({ variant: "destructive", title: "Error", description: "Not authenticated or database not available." });
            return;
        }

        setIsSubmitting(true);
        const pledgeData = getPledgeDataFromForm();

        if (!pledgeData) {
            toast({ variant: "destructive", title: "Form Error", description: "Could not derive pledge data from form. Check date formats." });
            setIsSubmitting(false);
            return;
        }

        try {
            if (editId) {
                await updatePledge(firestore, editId, pledgeData);
                toast({ title: "Pledge Updated", description: "Pledge details have been successfully updated." });
                router.push('/pledges');
            } else {
                const newPledgeId = await addPledge(firestore, pledgeData, repledgeId || undefined);
                setLastPledgeId(newPledgeId);
                setShowSuccessDialog(true);
                window.open(`/print/pledge/${newPledgeId}`, '_blank');
            }
        } catch (error) {
            console.error("Error creating pledge: ", error);
            toast({
                variant: "destructive",
                title: "Error Creating Pledge",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            })
        } finally {
            setIsSubmitting(false);
        }
    }


    return (
        <>
            {repledgeId && <Alert className="mb-4 text-center">
                <AlertTitle className="text-center text-lg">Repledge Mode</AlertTitle>
                <AlertDescription className="text-base">
                    Reference Pledge ID: <span className="text-2xl font-bold text-primary">{repledgeId}</span>
                </AlertDescription>
            </Alert>}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-3 space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer &amp; Scheme</CardTitle>
                                    <CardDescription>Select the customer and the loan scheme for this pledge.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <FormField
                                            control={control}
                                            name="customerId"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Customer</FormLabel>
                                                    <CustomerCombobox
                                                        customers={customers}
                                                        value={field.value}
                                                        onSelect={field.onChange}
                                                        onCustomerSelect={() => focusNext(loanDateRef.current)}
                                                    />
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={control}
                                                name="loanDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>Starting Date</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="DD-MM-YYYY"
                                                                {...field}
                                                                ref={(e) => {
                                                                    field.ref(e);
                                                                    (loanDateRef as any).current = e;
                                                                }}
                                                                onKeyDown={(e) => handleInputKeyDown(e, closingDateRef.current)}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="closingDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>Closing Date</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="DD-MM-YYYY"
                                                                {...field}
                                                                ref={(e) => {
                                                                    field.ref(e);
                                                                    (closingDateRef as any).current = e;
                                                                }}
                                                                onKeyDown={(e) => handleInputKeyDown(e, schemeButtonRef.current)}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <FormField
                                        control={control}
                                        name="schemeId"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Scheme (Optional)</FormLabel>
                                                <SchemeCombobox
                                                    schemes={schemes}
                                                    value={field.value || ""}
                                                    onSelect={field.onChange}
                                                    onSchemeSelect={() => focusNext(itemMetalTypeRefs.current[0], true)}
                                                    buttonRef={schemeButtonRef}
                                                />
                                                <FormDescription>Selecting a scheme will pre-fill loan details and calculate estimated values automatically.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Pledged Items</CardTitle>
                                    <CardDescription>Details of the items being pledged.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-4">
                                        {fields.map((field, index) => {
                                            const currentItem = watchedItems[index];
                                            const itemTypesDoc = currentItem.metalType === 'Gold' ? goldItemTypesDoc : silverItemTypesDoc;
                                            const itemTypes = itemTypesDoc?.types;

                                            const total = Number(currentItem?.totalWeight) || 0;
                                            const stone = Number(currentItem?.stoneWeight) || 0;
                                            const net = total > stone ? total - stone : 0;

                                            const itemRate = Number(currentItem?.ratePerGram) || 0;
                                            const schemeRate = selectedScheme?.ratePerGram || 0;
                                            const effectiveRate = itemRate > 0 ? itemRate : schemeRate;
                                            const estimatedValue = net * effectiveRate;

                                            const handleAddItemOrFocusNext = () => {
                                                if (index === fields.length - 1) {
                                                    append({ metalType: "Gold", type: "", quantity: 1, totalWeight: 0, stoneWeight: 0, purity: 91.6, ratePerGram: 0 });
                                                    setTimeout(() => focusNext(itemMetalTypeRefs.current[index + 1], true), 100);
                                                } else {
                                                    focusNext(itemMetalTypeRefs.current[index + 1], true);
                                                }
                                            };

                                            return (
                                                <div key={field.id} className="space-y-4 rounded-md border p-4 relative">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-sm font-medium text-muted-foreground pt-1">Item #{index + 1}</p>
                                                        {fields.length > 1 && (
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1" onClick={() => remove(index)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.metalType`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Metal Type</FormLabel>
                                                                    <Select onValueChange={(value) => {
                                                                        field.onChange(value);
                                                                        setValue(`items.${index}.type`, '');
                                                                        setTimeout(() => {
                                                                            const nextRef = itemTypeButtonRefs.current[index];
                                                                            if (nextRef) {
                                                                                focusNext(nextRef, true);
                                                                            }
                                                                        }, 100);
                                                                    }} defaultValue={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger ref={ref => { itemMetalTypeRefs.current[index] = ref; }}>
                                                                                <SelectValue placeholder="Select Metal" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="Gold">Gold</SelectItem>
                                                                            <SelectItem value="Silver">Silver</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.type`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Item Type</FormLabel>
                                                                    <ItemTypeCombobox
                                                                        itemTypes={itemTypes}
                                                                        value={field.value}
                                                                        onSelect={field.onChange}
                                                                        onTypeSelect={() => {
                                                                            setTimeout(() => focusNext(quantityInputRefs.current[index]), 0);
                                                                        }}
                                                                        buttonRef={ref => { itemTypeButtonRefs.current[index] = ref; }}
                                                                    />
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Quantity</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="number" min="1" {...field} ref={(el) => { quantityInputRefs.current[index] = el; }} onKeyDown={(e) => handleInputKeyDown(e, totalWeightInputRefs.current[index])} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.totalWeight`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Total Wt. (g)</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="number" step="0.01" {...field} ref={ref => { totalWeightInputRefs.current[index] = ref; }} onKeyDown={(e) => handleInputKeyDown(e, stoneWeightInputRefs.current[index])} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.stoneWeight`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Stone Wt. (g)</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="number" step="0.01" {...field} ref={ref => { stoneWeightInputRefs.current[index] = ref; }} onKeyDown={(e) => handleInputKeyDown(e, purityInputRefs.current[index])} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormItem>
                                                            <FormLabel>Net Wt. (g)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" value={net.toFixed(2)} readOnly className="bg-muted font-medium" />
                                                            </FormControl>
                                                        </FormItem>
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.purity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Purity %</FormLabel>
                                                                    <FormControl>
                                                                        <Input type="number" step="0.1" {...field} ref={ref => { purityInputRefs.current[index] = ref; }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (index === fields.length - 1) { focusNext(loanAmountInputRef.current); } else { handleAddItemOrFocusNext(); } } }} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <FormField
                                                            control={control}
                                                            name={`items.${index}.ratePerGram`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Rate/g (₹)</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            {...field}
                                                                            placeholder={selectedScheme?.ratePerGram?.toString() || "Enter rate"}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormItem>
                                                            <FormLabel>Est. Value (₹)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" value={estimatedValue.toFixed(0)} readOnly className="bg-muted font-medium" />
                                                            </FormControl>
                                                        </FormItem>
                                                    </div>

                                                </div>
                                            )
                                        })}
                                    </div>

                                    <Button type="button" variant="outline" size="sm" onClick={() => {
                                        append({ metalType: "Gold", type: "", quantity: 1, totalWeight: 0, stoneWeight: 0, purity: 91.6, ratePerGram: 0 });
                                        setTimeout(() => focusNext(itemMetalTypeRefs.current[fields.length], true), 100);
                                    }}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add item
                                    </Button>

                                    <Separator />

                                    <FormItem>
                                        <FormLabel>Total Estimated Value (₹)</FormLabel>
                                        <FormControl>
                                            <Input type="number" readOnly value={totalEstimatedValue.toFixed(0)} className="bg-muted font-bold text-lg" />
                                        </FormControl>
                                    </FormItem>

                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Loan Details</CardTitle>
                                    <CardDescription>Enter the loan details manually if not using a scheme.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <FormField
                                            control={control}
                                            name="loanAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Loan Amount (₹)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            {...field}
                                                            ref={loanAmountInputRef}
                                                            onKeyDown={(e) => handleInputKeyDown(e, docChargesInputRef.current)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={control}
                                            name="documentCharges"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Doc. Charges (₹)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} ref={docChargesInputRef} onKeyDown={(e) => handleInputKeyDown(e, interestRateInputRef.current)} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={control}
                                            name="interestRate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Interest Rate (% p.m.)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.1" {...field} ref={interestRateInputRef} onKeyDown={(e) => handleInputKeyDown(e, loanDurationInputRef.current)} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <FormField
                                                control={control}
                                                name="loanDuration"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Duration</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} ref={loanDurationInputRef} onKeyDown={(e) => handleInputKeyDown(e, loanDurationTypeRef.current)} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="loanDurationType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Type</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger ref={loanDurationTypeRef}>
                                                                    <SelectValue placeholder="Type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Days">Days</SelectItem>
                                                                <SelectItem value="Months">Months</SelectItem>
                                                                <SelectItem value="Years">Years</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                        <FormItem>
                                            <FormLabel>One Month Interest (₹)</FormLabel>
                                            <FormControl>
                                                <Input type="text" readOnly value={`₹ ${oneMonthInterest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} className="bg-muted font-medium" />
                                            </FormControl>
                                        </FormItem>
                                        <div className="text-right">
                                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Final Settlement (₹)</label>
                                            <h1 className="text-3xl font-bold text-primary mt-1">
                                                {`₹ ${finalSettlementAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                            </h1>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                                <CardContent>
                                    <FormField
                                        control={control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Textarea placeholder="Add any relevant notes..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-1 space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Item Photo</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {showCamera ? (
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
                                            </div>
                                            {hasCameraPermission === false && (
                                                <Alert variant="destructive">
                                                    <AlertTitle>Camera Access Required</AlertTitle>
                                                    <AlertDescription>
                                                        Please enable camera permissions in your browser settings and try again.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            <canvas ref={canvasRef} className="hidden" />
                                            <div className="flex justify-end gap-2">
                                                <Button type="button" variant="outline" onClick={() => setShowCamera(false)}>Cancel</Button>
                                                <Button variant="outline" size="icon" onClick={toggleFacingMode} disabled={hasCameraPermission !== true}>
                                                    <SwitchCamera className="h-4 w-4" />
                                                </Button>
                                                <Button type="button" onClick={takePicture} disabled={hasCameraPermission !== true}>Take Picture</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 flex flex-col items-center">
                                            <div className="w-full aspect-video rounded-md bg-muted flex items-center justify-center">
                                                {photo ? (
                                                    <Image src={photo} alt="Pledged item" width={160} height={90} className="rounded-md object-cover w-full h-full" />
                                                ) : (
                                                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                                                )}
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={() => setShowCamera(true)}>
                                                <Camera className="mr-2 h-4 w-4" />
                                                {photo ? 'Retake Photo' : 'Take Photo'}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                        <Button type="submit" disabled={isSubmitting || !formState.isValid}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editId ? "Update Pledge" : "Create Pledge"}
                        </Button>
                </form>
            </Form>
            <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex justify-center">
                            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                        </div>
                        <DialogTitle className="text-center text-2xl">Pledge Created Successfully!</DialogTitle>
                        <DialogDescription className="text-center">
                            The voucher is opening in a new tab for printing.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center gap-4 py-4">
                        <DialogClose asChild>
                            <Button variant="outline" onClick={() => router.push(`/pledges`)}>Go to Pledges</Button>
                        </DialogClose>
                        <Button asChild>
                            <Link href={`/print/pledge/${lastPledgeId}`} target="_blank">
                                <Printer className="mr-2 h-4 w-4" />
                                Reprint Voucher
                            </Link>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
