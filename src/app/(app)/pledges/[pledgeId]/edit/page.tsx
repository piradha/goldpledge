
'use client'

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const CreatePledgeForm = dynamic(() => import('../../new/create-pledge-form').then(mod => mod.CreatePledgeForm), { ssr: false });

export default function EditPledgePage() {
    const params = useParams();
    const pledgeId = params.pledgeId as string;

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Edit Pledge: {pledgeId}</h1>
            <CreatePledgeForm editId={pledgeId} />
        </div>
    )
}
