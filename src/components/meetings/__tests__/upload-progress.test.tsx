import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UploadProgress } from "../upload-progress";

const defaultProps = {
  stage: "idle" as const,
  uploadProgress: 0,
  fileName: "meeting.mp3",
  fileSize: 5 * 1024 * 1024, // 5MB
  onCancel: vi.fn(),
  onRetry: vi.fn(),
};

afterEach(() => cleanup());

describe("UploadProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders file name and formatted size", () => {
    render(<UploadProgress {...defaultProps} stage="uploading" />);
    expect(screen.getByText("meeting.mp3")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
  });

  it("formats sizes correctly", () => {
    const { rerender } = render(
      <UploadProgress {...defaultProps} stage="uploading" fileSize={512} />,
    );
    expect(screen.getByText("512 B")).toBeInTheDocument();

    rerender(
      <UploadProgress {...defaultProps} stage="uploading" fileSize={2048} />,
    );
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();

    rerender(
      <UploadProgress
        {...defaultProps}
        stage="uploading"
        fileSize={2 * 1024 * 1024 * 1024}
      />,
    );
    expect(screen.getByText("2.0 GB")).toBeInTheDocument();
  });

  describe("uploading stage", () => {
    it("shows upload progress bar with percentage", () => {
      render(
        <UploadProgress
          {...defaultProps}
          stage="uploading"
          uploadProgress={42}
        />,
      );
      expect(screen.getByText("42%")).toBeInTheDocument();
      expect(screen.getByText("Uploading...")).toBeInTheDocument();
      expect(screen.getByLabelText("Upload progress")).toBeInTheDocument();
    });

    it("shows cancel button", () => {
      render(<UploadProgress {...defaultProps} stage="uploading" />);
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("cancel button calls onCancel", () => {
      const onCancel = vi.fn();
      render(
        <UploadProgress
          {...defaultProps}
          stage="uploading"
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByText("Cancel"));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("transcribing stage", () => {
    it("shows transcribing text", () => {
      render(<UploadProgress {...defaultProps} stage="transcribing" />);
      expect(screen.getByText("Transcribing audio...")).toBeInTheDocument();
    });

    it("shows cancel button", () => {
      render(<UploadProgress {...defaultProps} stage="transcribing" />);
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("does not show upload progress bar", () => {
      render(<UploadProgress {...defaultProps} stage="transcribing" />);
      expect(
        screen.queryByLabelText("Upload progress"),
      ).not.toBeInTheDocument();
    });
  });

  describe("reviewing stage", () => {
    it("does not show cancel button", () => {
      render(<UploadProgress {...defaultProps} stage="reviewing" />);
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });

    it("does not show error", () => {
      render(
        <UploadProgress
          {...defaultProps}
          stage="reviewing"
          errorMessage="some error"
        />,
      );
      expect(screen.queryByText("some error")).not.toBeInTheDocument();
    });
  });

  describe("processing stage", () => {
    it("shows processing text", () => {
      render(<UploadProgress {...defaultProps} stage="processing" />);
      expect(
        screen.getByText("Processing with Claude AI..."),
      ).toBeInTheDocument();
    });

    it("does not show cancel button", () => {
      render(<UploadProgress {...defaultProps} stage="processing" />);
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });
  });

  describe("error stage", () => {
    it("shows error message", () => {
      render(
        <UploadProgress
          {...defaultProps}
          stage="error"
          errorMessage="Upload failed: network error"
        />,
      );
      expect(
        screen.getByText("Upload failed: network error"),
      ).toBeInTheDocument();
    });

    it("shows retry button", () => {
      render(
        <UploadProgress
          {...defaultProps}
          stage="error"
          errorMessage="Failed"
        />,
      );
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("retry button calls onRetry", () => {
      const onRetry = vi.fn();
      render(
        <UploadProgress
          {...defaultProps}
          stage="error"
          errorMessage="Failed"
          onRetry={onRetry}
        />,
      );
      fireEvent.click(screen.getByText("Retry"));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("does not show cancel button in error state", () => {
      render(
        <UploadProgress
          {...defaultProps}
          stage="error"
          errorMessage="Failed"
        />,
      );
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });

    it("does not show error section without errorMessage", () => {
      render(<UploadProgress {...defaultProps} stage="error" />);
      expect(screen.queryByText("Retry")).not.toBeInTheDocument();
    });
  });

  describe("stepper labels", () => {
    it("shows all four step labels", () => {
      render(<UploadProgress {...defaultProps} stage="uploading" />);
      expect(screen.getByText("Upload")).toBeInTheDocument();
      expect(screen.getByText("Transcribe")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
      expect(screen.getByText("Process")).toBeInTheDocument();
    });
  });
});
