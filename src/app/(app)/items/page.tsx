
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useFirebase, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, query, collection, where } from 'firebase/firestore';
import { ItemType, UserProfile, Shop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function ItemCategory({ title, metalType }: { title: string; metalType: 'Gold' | 'Silver' }) {
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    const [newItem, setNewItem] = useState('');
    const { toast } = useToast();

    const userProfileQuery = useMemoFirebase(
      () => (firestore && user?.email ? query(collection(firestore, 'users'), where('email', '==', user.email)) : null),
      [firestore, user?.email]
    );
    const { data: userProfiles, isLoading: isProfileLoading } = useCollection<UserProfile>(userProfileQuery);
    const userProfile = useMemo(() => (userProfiles && userProfiles[0]) ? userProfiles[0] : null, [userProfiles]);

    const itemTypeId = userProfile ? `${metalType}_${userProfile.shopId}` : null;
    const itemTypeRef = useMemoFirebase(
        () => (firestore && itemTypeId ? doc(firestore, 'itemTypes', itemTypeId) : null),
        [firestore, itemTypeId]
    );

    const { data: itemTypeDoc, isLoading: isItemTypeLoading } = useDoc<Omit<ItemType, 'id'>>(itemTypeRef);

    const items = itemTypeDoc?.types || [];
    const isLoading = isUserLoading || isProfileLoading || isItemTypeLoading;

    const handleAddItem = async () => {
        if (!newItem.trim() || !itemTypeRef || !userProfile?.shopId) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Cannot add item: Shop information is missing or input is empty.'
            });
            return;
        }

        const newItemsToAdd = newItem
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0 && !items.includes(item));
            
        if (newItemsToAdd.length === 0) {
            setNewItem('');
            toast({
                title: 'No new items added',
                description: 'The item(s) you entered already exist or the input was empty.'
            })
            return;
        }
        
        const updatedItems = [...items, ...newItemsToAdd];
        
        try {
            await setDoc(itemTypeRef, {
                shopId: userProfile.shopId,
                metalType,
                types: updatedItems
            }, { merge: true });
            
            setNewItem('');
            toast({
                title: 'Items Added',
                description: `${newItemsToAdd.join(', ')} have been added.`
            })
        } catch (error) {
            console.error("Failed to add item:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not add the new item type(s).'
            });
        }
    };

    const handleRemoveItem = async (itemToRemove: string) => {
        if (!itemTypeRef || !userProfile?.shopId) return;

        const updatedItems = items.filter(item => item !== itemToRemove);
        try {
            await setDoc(itemTypeRef, {
                shopId: userProfile.shopId,
                metalType,
                types: updatedItems
            }, { merge: true });
        } catch (error) {
             console.error("Failed to remove item:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not remove the item type.'
            });
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className={metalType === 'Gold' ? 'text-yellow-500' : 'text-slate-400'}>{title}</CardTitle>
                <CardDescription>Manage item types for {title}. You can add multiple types at once by separating them with a comma.</CardDescription>
            </CardHeader>
            <CardContent className="min-h-[150px]">
                {isLoading ? (
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {items.length > 0 ? items.map((item) => (
                             <Badge key={item} variant="secondary" className="text-sm group relative pr-6">
                                {item}
                                <button onClick={() => handleRemoveItem(item)} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </Badge>
                        )) : (
                            <p className="text-sm text-muted-foreground">No item types added yet.</p>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <div className="flex w-full items-center space-x-2">
                    <Input
                        type="text"
                        placeholder="Add new type (e.g. Ring, Chain)..."
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading || !userProfile?.shopId}
                    />
                    <Button onClick={handleAddItem} size="icon" disabled={isLoading || !newItem.trim() || !userProfile?.shopId}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}


export default function ItemsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Item Management</h1>
            <div className="grid md:grid-cols-2 gap-6">
                <ItemCategory title="Gold Items" metalType="Gold" />
                <ItemCategory title="Silver Items" metalType="Silver" />
            </div>
        </div>
    );
}
