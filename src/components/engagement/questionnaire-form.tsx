"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveQuestionnaireAnswers,
  getQuestionCategories,
  type QuestionDef,
} from "@/lib/actions/questionnaire";
import type { EngagementQuestionnaire } from "@/lib/types";

interface QuestionnaireFormProps {
  questionnaire: EngagementQuestionnaire;
  questions: QuestionDef[];
  readOnly?: boolean;
}

export function QuestionnaireForm({
  questionnaire,
  questions,
  readOnly = false,
}: QuestionnaireFormProps) {
  const router = useRouter();
  const categories = getQuestionCategories(questions);
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(
    (questionnaire.answers as Record<string, unknown>) ?? {},
  );
  const [saving, setSaving] = React.useState(false);

  const currentCategory = categories[step] ?? "";
  const currentQuestions = questions.filter(
    (q) => q.category === currentCategory,
  );
  const isLast = step === categories.length - 1;
  const progressPercent =
    categories.length > 0 ? ((step + 1) / categories.length) * 100 : 0;

  function updateAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSave(isComplete: boolean) {
    setSaving(true);
    const result = await saveQuestionnaireAnswers(
      questionnaire.id,
      answers,
      isComplete,
    );
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else if (isComplete) {
      toast.success("Questionnaire submitted! Answers are being processed.");
      router.push("/engagement");
    } else {
      toast.success("Progress saved");
    }
  }

  async function handleNext() {
    // Auto-save on step change
    await handleSave(false);
    setStep((s) => Math.min(s + 1, categories.length - 1));
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Step {step + 1} of {categories.length}
          </span>
          <span className="font-medium">{currentCategory}</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Category steps */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat, i) => (
          <button
            key={cat}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{currentCategory}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {currentQuestions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => updateAnswer(q.id, v)}
              readOnly={readOnly}
            />
          ))}
        </CardContent>
      </Card>

      {/* Navigation */}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePrev} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save Progress
          </Button>

          {isLast ? (
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              Submit
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={saving}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  readOnly,
}: {
  question: QuestionDef;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly: boolean;
}) {
  const strVal = typeof value === "string" ? value : "";

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {question.question}
        {question.required && <span className="ml-1 text-destructive">*</span>}
      </Label>

      {question.type === "text" && (
        <Input
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          placeholder="Type your answer..."
        />
      )}

      {question.type === "textarea" && (
        <Textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          placeholder="Type your answer..."
          rows={3}
        />
      )}

      {question.type === "select" && question.options && (
        <Select
          value={strVal}
          onValueChange={(v) => onChange(v)}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {question.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {question.type === "multiselect" && question.options && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  const arr = Array.isArray(value) ? [...value] : [];
                  if (selected) {
                    onChange(arr.filter((v) => v !== opt));
                  } else {
                    onChange([...arr, opt]);
                  }
                }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/25"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "toggle" && (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(!value)}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            value
              ? "border-primary bg-primary/10 text-primary"
              : "border-muted-foreground/25 text-muted-foreground"
          }`}
        >
          {value ? "Yes" : "No"}
        </button>
      )}
    </div>
  );
}
