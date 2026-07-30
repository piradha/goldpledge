
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { createShopAndLinkToUser, reassignShopOwner } from '@/firebase/firestore/admin';
import { Loader2, MoreHorizontal, Save, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { collection } from 'firebase/firestore';
import { Shop, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SUPER_ADMIN_EMAIL } from '@/lib/config';


const createFormSchema = z.object({
  shopName: z.string().min(3, { message: 'Shop name must be at least 3 characters.' }),
  ownerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
});

function CreatedShopsList() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editedEmail, setEditedEmail] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const shopsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shops') : null, [firestore]);
  const { data: shops, isLoading: isLoadingShops } = useCollection<Shop>(shopsQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const shopsWithEmails = useMemo(() => {
    if (!shops || !users) return [];
    
    const userMap = new Map(users.map(user => [user.id, user.email]));
    
    return shops.map(shop => ({
      ...shop,
      ownerEmail: userMap.get(shop.ownerId) || 'N/A',
    }));
  }, [shops, users]);

  const isLoading = isLoadingShops || isLoadingUsers;

  const handleEditClick = (shop: Shop & { ownerEmail: string }) => {
    setEditingShopId(shop.id);
    setEditedEmail(shop.ownerEmail === 'N/A' ? '' : shop.ownerEmail);
  };

  const handleCancelEdit = () => {
    setEditingShopId(null);
    setEditedEmail('');
  };

  const handleOwnerChange = async () => {
    if (!firestore || !editingShopId) {
      toast({ variant: 'destructive', title: 'Firestore not available' });
      return;
    }
    const shopToUpdate = shopsWithEmails.find(s => s.id === editingShopId);
    if (!shopToUpdate) return;
    
    // Basic email validation
    if (!z.string().email().safeParse(editedEmail).success) {
      toast({ variant: 'destructive', title: 'Invalid Email', description: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await reassignShopOwner(firestore, shopToUpdate, editedEmail);
      toast({
        title: 'Owner Changed Successfully',
        description: `Shop "${shopToUpdate.name}" has been reassigned to ${editedEmail}.`,
      });
      handleCancelEdit();
    } catch (error: any) {
      console.error('Error reassigning owner:', error);
      toast({
        variant: 'destructive',
        title: 'Error Changing Owner',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
        setIsSubmittingEdit(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Existing Shops</CardTitle>
        <CardDescription>A list of all shops that have been created in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop Name</TableHead>
              <TableHead>Shop Number</TableHead>
              <TableHead>Owner Email</TableHead>
              <TableHead className="text-right w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                <TableRow>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              </>
            )}
            {!isLoading && shopsWithEmails.length > 0 && shopsWithEmails.map(shop => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.name}</TableCell>
                <TableCell>{shop.shopNumber}</TableCell>
                <TableCell>
                  {editingShopId === shop.id ? (
                    <Input
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      placeholder="new.owner@example.com"
                      className="h-8"
                    />
                  ) : (
                    shop.ownerEmail
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingShopId === shop.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOwnerChange} disabled={isSubmittingEdit}>
                         {isSubmittingEdit ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(shop)}>
                           Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
             {!isLoading && shopsWithEmails.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        No shops have been created yet.
                    </TableCell>
                </TableRow>
             )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


export default function AdminPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      shopName: '',
      ownerEmail: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof createFormSchema>) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Firestore not available' });
      return;
    }
    setIsSubmitting(true);
    try {
      await createShopAndLinkToUser(firestore, values.shopName, values.ownerEmail);
      toast({
        title: 'Shop Created Successfully',
        description: `Shop "${values.shopName}" has been created and assigned to ${values.ownerEmail}.`,
      });
      form.reset();
    } catch (error: any) {
      console.error('Error creating shop:', error);
      toast({
        variant: 'destructive',
        title: 'Error Creating Shop',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Security Check: Only allow the super admin to see this page.
  if (user?.email !== SUPER_ADMIN_EMAIL) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You do not have permission to access this page.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This section is reserved for the application administrator.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
       <Alert className="mb-6">
        <AlertTitle>Admin Control Panel</AlertTitle>
        <AlertDescription>
          Use this form to create a new shop and assign it to a user's email. If the user doesn't exist, a profile will be created for them, linked to this shop.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Create New Shop</CardTitle>
          <CardDescription>
            A unique Shop Number will be generated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="shopName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Majestic Jewelers" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner's Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., owner@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Shop
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <CreatedShopsList />
    </div>
  );
}
