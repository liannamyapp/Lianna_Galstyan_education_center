"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { ageOn } from "@/lib/age";
import { signContractAction } from "../../../actions";

/** Signing step: learner's date of birth; under 18 → a parent or legal guardian signs instead. */
export function SignForm({ locale, appId, method, learnerName, birthDate, t }: {
  locale: string; appId: string; method: string; learnerName: string; birthDate: string; t: Record<string, string>;
}) {
  // all fields are controlled, so nothing is lost when the server answers with an error
  const [birth, setBirth] = useState(birthDate);
  const [relation, setRelation] = useState("parent");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [adultSig, setAdultSig] = useState(learnerName);
  const [guardianSig, setGuardianSig] = useState("");
  const age = birth ? ageOn(birth) : null;
  const minor = age !== null && age < 18;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={signContractAction} className="card mt-6 flex flex-col gap-4 border-2 border-gold-500/60 p-5 sm:p-8 print:hidden">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={appId} />
      <input type="hidden" name="method" value={method} />
      <div>
        <h2 className="m-0 font-serif text-[22px] font-bold text-navy-900">{t.signTitle}</h2>
        <p className="mt-1.5 mb-0 text-[14.5px] text-muted">{t.signIntro}</p>
      </div>

      <label className="label max-w-[300px]">{t.birthDate}
        <input type="date" name="birthDate" required min="1920-01-01" max={today} value={birth} onChange={(e) => setBirth(e.target.value)} className="input" />
      </label>
      {age !== null && (
        <p className={`m-0 rounded-xl px-4 py-3 text-[14px] ${minor ? "border border-[#f1dcb4] bg-[#fdf6e7] text-[#7a5a12]" : "bg-[#eef7f0] text-[#1f5f33]"}`}>
          {minor ? t.minorDetected : t.adultOk}
        </p>
      )}

      {minor && (
        <fieldset className="m-0 flex flex-col gap-3.5 rounded-2xl border border-[#eadfc8] bg-[#fbf8f1] p-4 sm:p-5">
          <legend className="px-1 text-[14px] font-bold text-navy-900">{t.guardianTitle}</legend>
          <label className="label">{t.guardianRelation}
            <select name="guardianRelation" required value={relation} onChange={(e) => setRelation(e.target.value)} className="input">
              <option value="parent">{t.relParent}</option>
              <option value="guardian">{t.relGuardian}</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-3.5">
            <label className="label min-w-0 flex-[1_1_220px]">{t.guardianPhone}<input name="guardianPhone" type="tel" required autoComplete="tel" placeholder="+374" value={gPhone} onChange={(e) => setGPhone(e.target.value)} className="input" /></label>
            <label className="label min-w-0 flex-[1_1_220px]">{t.guardianEmail}<input name="guardianEmail" type="email" autoComplete="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} className="input" /></label>
          </div>
        </fieldset>
      )}

      <label className="flex items-start gap-3 text-[15px] text-[#2b3445]">
        <input type="checkbox" name="agree" value="1" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-[18px] flex-none accent-navy-800" />
        <span>{minor ? t.agreeGuardian : t.agree} <Link href={`/${locale}/p/refund`} target="_blank">{t.refundLink}</Link></span>
      </label>
      <label className="label">{minor ? t.signNameGuardian : t.signName}
        <input name="signature" required minLength={3} value={minor ? guardianSig : adultSig} onChange={(e) => (minor ? setGuardianSig : setAdultSig)(e.target.value)} autoComplete="name" className="input font-serif text-[18px] italic" />
      </label>
      <SubmitButton className="btn-navy min-h-13 self-start px-8" pendingText={t.signing}>{method ? t.signBtnPay : t.signBtn}</SubmitButton>
    </ActionForm>
  );
}
