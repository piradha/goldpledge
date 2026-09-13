'use client';

import { useState, useEffect } from 'react';
import { Firestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Pledge, RepledgeHistoryItem } from '@/lib/types';

/**
 * Extracts the immediately previous pledge reference ID from a Pledge object.
 * Checks previousPledgeDocId first, then previousPledgeId, and falls back to notes regex.
 */
export function getPreviousPledgeReference(pledge: Pledge): string | null {
    if (pledge.previousPledgeDocId && pledge.previousPledgeDocId.trim() !== '') {
        return pledge.previousPledgeDocId.trim();
    }
    if (pledge.previousPledgeId && pledge.previousPledgeId.trim() !== '') {
        return pledge.previousPledgeId.trim();
    }
    if (pledge.notes) {
        const match = pledge.notes.match(/Repledge of ([\w-]+)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}

/**
 * Bidirectionally traverses from the current pledge:
 * 1. Backwards to root original pledge
 * 2. Forwards to the latest descendant repledge
 * 
 * Returns the full lineage in chronological order:
 * [Original Pledge (Level 1), Repledge #1 (Level 2), ..., Latest Pledge (Level N)]
 * with `isCurrent: true` on the pledge corresponding to the current view.
 */
export async function getRepledgeHistory(
    firestore: Firestore,
    currentPledge: Pledge
): Promise<RepledgeHistoryItem[]> {
    if (!firestore || !currentPledge) {
        return [];
    }

    const visitedDocIds = new Set<string>();
    const MAX_DEPTH = 50;

    visitedDocIds.add(currentPledge.id);

    const currentItem: RepledgeHistoryItem = {
        id: currentPledge.id,
        pledgeId: currentPledge.id,
        customerName: currentPledge.customerName,
        createdAt: currentPledge.createdAt,
        loanAmount: Number(currentPledge.loanAmount) || 0,
        paidAmount: Number(currentPledge.paidAmount) || 0,
        interestPaid: Number(currentPledge.interestPaid) || 0,
        interestRate: Number(currentPledge.interestRate) || 0,
        status: currentPledge.status || 'ACTIVE',
        isCurrent: true,
        historyLevel: 0,
        repledgeDate: currentPledge.repledgeDate || null,
        notes: currentPledge.notes,
        pledge: currentPledge,
    };

    // 1. Backward Traversal (Find all ancestors)
    const backwardChain: RepledgeHistoryItem[] = [];
    let nextDocIdToFetch = getPreviousPledgeReference(currentPledge);
    let backwardDepth = 0;

    while (nextDocIdToFetch && backwardDepth < MAX_DEPTH) {
        const currentDocIdToFetch: string = nextDocIdToFetch;

        if (visitedDocIds.has(currentDocIdToFetch)) {
            console.warn(`[RepledgeHistory] Circular reference detected at document ID: ${currentDocIdToFetch}`);
            break;
        }

        visitedDocIds.add(currentDocIdToFetch);
        backwardDepth++;

        try {
            const prevDocRef = doc(firestore, 'pledges', currentDocIdToFetch);
            const prevDocSnap = await getDoc(prevDocRef);

            if (!prevDocSnap.exists()) {
                backwardChain.push({
                    id: currentDocIdToFetch,
                    pledgeId: currentDocIdToFetch,
                    loanAmount: 0,
                    paidAmount: 0,
                    interestPaid: 0,
                    status: 'UNAVAILABLE',
                    isCurrent: false,
                    historyLevel: 0,
                    isUnavailable: true,
                });
                break;
            }

            const prevPledgeData = { ...prevDocSnap.data(), id: prevDocSnap.id } as Pledge;

            backwardChain.push({
                id: prevPledgeData.id,
                pledgeId: prevPledgeData.id,
                customerName: prevPledgeData.customerName,
                createdAt: prevPledgeData.createdAt,
                loanAmount: Number(prevPledgeData.loanAmount) || 0,
                paidAmount: Number(prevPledgeData.paidAmount) || 0,
                interestPaid: Number(prevPledgeData.interestPaid) || 0,
                interestRate: Number(prevPledgeData.interestRate) || 0,
                status: prevPledgeData.status || 'CLOSED',
                isCurrent: false,
                historyLevel: 0,
                repledgeDate: prevPledgeData.repledgeDate || null,
                notes: prevPledgeData.notes,
                pledge: prevPledgeData,
            });

            nextDocIdToFetch = getPreviousPledgeReference(prevPledgeData);

        } catch (error) {
            console.error(`[RepledgeHistory] Error fetching pledge document ${currentDocIdToFetch}:`, error);
            backwardChain.push({
                id: currentDocIdToFetch,
                pledgeId: currentDocIdToFetch,
                loanAmount: 0,
                paidAmount: 0,
                interestPaid: 0,
                status: 'ERROR',
                isCurrent: false,
                historyLevel: 0,
                isUnavailable: true,
            });
            break;
        }
    }

    // 2. Forward Traversal (Find all descendant repledges from this pledge)
    const forwardChain: RepledgeHistoryItem[] = [];
    let currForwardId = currentPledge.id;
    let forwardDepth = 0;

    while (forwardDepth < MAX_DEPTH) {
        forwardDepth++;
        let nextChildDoc: Pledge | null = null;

        try {
            // Check if any pledge points to currForwardId as previousPledgeDocId
            const qDocId = query(collection(firestore, 'pledges'), where('previousPledgeDocId', '==', currForwardId));
            const snapDocId = await getDocs(qDocId);

            if (!snapDocId.empty) {
                const d = snapDocId.docs[0];
                nextChildDoc = { ...d.data(), id: d.id } as Pledge;
            } else {
                // Fallback check on previousPledgeId
                const qBizId = query(collection(firestore, 'pledges'), where('previousPledgeId', '==', currForwardId));
                const snapBizId = await getDocs(qBizId);
                if (!snapBizId.empty) {
                    const d = snapBizId.docs[0];
                    nextChildDoc = { ...d.data(), id: d.id } as Pledge;
                }
            }

            if (!nextChildDoc || visitedDocIds.has(nextChildDoc.id)) {
                break;
            }

            visitedDocIds.add(nextChildDoc.id);

            forwardChain.push({
                id: nextChildDoc.id,
                pledgeId: nextChildDoc.id,
                customerName: nextChildDoc.customerName,
                createdAt: nextChildDoc.createdAt,
                loanAmount: Number(nextChildDoc.loanAmount) || 0,
                paidAmount: Number(nextChildDoc.paidAmount) || 0,
                interestPaid: Number(nextChildDoc.interestPaid) || 0,
                interestRate: Number(nextChildDoc.interestRate) || 0,
                status: nextChildDoc.status || 'ACTIVE',
                isCurrent: false,
                historyLevel: 0,
                repledgeDate: nextChildDoc.repledgeDate || null,
                notes: nextChildDoc.notes,
                pledge: nextChildDoc,
            });

            currForwardId = nextChildDoc.id;

        } catch (error) {
            console.error(`[RepledgeHistory] Error in forward traversal for doc ID ${currForwardId}:`, error);
            break;
        }
    }

    // Combine: [Original ... Parents (reversed backwardChain), Current, Children ... Latest (forwardChain)]
    const fullChronologicalChain = [
        ...backwardChain.reverse(),
        currentItem,
        ...forwardChain,
    ];

    fullChronologicalChain.forEach((item, index) => {
        item.historyLevel = index + 1;
    });

    return fullChronologicalChain;
}

/**
 * React Hook for fetching and memoizing repledge history for a pledge.
 */
export function useRepledgeHistory(
    pledge: Pledge | null | undefined,
    firestore: Firestore | null | undefined
) {
    const [history, setHistory] = useState<RepledgeHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const prevRef = pledge ? getPreviousPledgeReference(pledge) : null;
    const isRepledge = Boolean(pledge?.isRepledge || prevRef);

    useEffect(() => {
        let isMounted = true;

        if (!pledge || !firestore) {
            setHistory([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        getRepledgeHistory(firestore, pledge)
            .then((res) => {
                if (isMounted) {
                    setHistory(res);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("[useRepledgeHistory] Failed to retrieve history:", err);
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [
        pledge?.id,
        pledge?.previousPledgeDocId,
        pledge?.previousPledgeId,
        pledge?.notes,
        pledge?.isRepledge,
        firestore,
        isRepledge,
        prevRef,
    ]);

    // hasHistory is true if the lineage contains more than 1 pledge
    const hasHistory = history.length > 1;

    return { history, isLoading, error, hasHistory };
}
