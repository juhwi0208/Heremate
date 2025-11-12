// client/src/features/report/ReportModal.js
import React, { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import axios from '../../api/axiosInstance';

const REASONS = [
  {key:'spam', label:'스팸'},
  {key:'abuse', label:'욕설/혐오'},
  {key:'scam', label:'사기'},
  {key:'nsfw', label:'부적절'},
  {key:'noshow', label:'노쇼'},
  {key:'etc', label:'기타'},
];

export default function ReportModal({ targetUserId, context='chat', refId=null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('abuse');
  const [detail, setDetail] = useState('');

  const submit = async () => {
    await axios.post('/reports', {
      target_user_id: targetUserId,
      context, reason, ref_id: refId || undefined, detail: detail || undefined
    });
    setOpen(false);
    alert('신고가 접수되었습니다.');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive">신고</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>신고하기</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>사유</Label>
            <div className="flex flex-wrap gap-2">
              {REASONS.map(r=>(
                <button key={r.key} onClick={()=>setReason(r.key)}
                  className={`px-3 py-1 rounded-full border text-sm ${reason===r.key?'bg-red-600 text-white border-red-600':'bg-white text-zinc-700'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>상세 내용(선택)</Label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={4}
              value={detail} onChange={e=>setDetail(e.target.value)} />
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>제출</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
