
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";

type ImagePreviewDialogProps = {
  children: React.ReactNode;
  imageUrl: string;
  name: string;
};

export function ImagePreviewDialog({ children, imageUrl, name }: ImagePreviewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square w-full">
          <Image
            src={imageUrl}
            alt={`Photo of ${name}`}
            fill
            className="object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
