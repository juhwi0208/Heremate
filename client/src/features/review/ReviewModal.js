// client/src/features/review/ReviewModal.js
import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import axios from '../../api/axiosInstance';

export default function ReviewModal({ targetId, tripId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [emotion, setEmotion] = useState('positive');
  const [tags, setTags] = useState('');
  const [comment, setComment] = useState('');

  const submit = async () => {
    const body = {
      target_id: targetId,
      trip_id: tripId,
      emotion,
      tags: tags ? tags.split(',').map(s=>s.trim()).filter(Boolean) : [],
      comment: comment || undefined
    };
    await axios.post('/reviews', body);
    setOpen(false);
    onSaved && onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">후기 쓰기</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>후기 작성</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>감정</Label>
            <div className="flex gap-2">
              {['positive','neutral','negative'].map(v=>(
                <button key={v}
                  onClick={()=>setEmotion(v)}
                  className={`px-3 py-1 rounded-full border text-sm ${emotion===v?'bg-emerald-600 text-white border-emerald-600':'bg-white text-zinc-700'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>키워드 (쉼표로 구분)</Label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="시간약속 철저, 대화 잘 통해요"
              value={tags} onChange={e=>setTags(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>코멘트(선택)</Label>
            <Textarea rows={4} value={comment} onChange={e=>setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
