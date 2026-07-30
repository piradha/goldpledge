
'use client'

import dynamic from 'next/dynamic';

const CreatePledgeForm = dynamic(() => import('./create-pledge-form').then(mod => mod.CreatePledgeForm), { ssr: false });

export default function NewPledgePage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Create New Pledge</h1>
            <CreatePledgeForm />
        </div>
    )
}
