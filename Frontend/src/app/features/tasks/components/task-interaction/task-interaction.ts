import {
  Component,
  Input,
  OnInit,
  inject
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  TaskComment,
  TaskComments
} from '../../../../core/services/task-comments';

import {
  TaskAttachment,
  TaskAttachments
} from '../../../../core/services/task-attachments';

import {
  BoardTask
} from '../../../../core/services/task-board-scope';

import {
  TokenStorage
} from '../../../../core/services/token-storage';


type InteractionTab =
  | 'comments'
  | 'attachments';


@Component({
  selector: 'app-task-interaction',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './task-interaction.html',

  styleUrl:
    './task-interaction.scss'
})
export class TaskInteraction
  implements OnInit {

  @Input({
    required: true
  })
  task!: BoardTask;


  private readonly commentsService =
    inject(TaskComments);

  private readonly attachmentsService =
    inject(TaskAttachments);

  private readonly tokenStorage =
    inject(TokenStorage);

  private readonly formBuilder =
    inject(FormBuilder);


  readonly maximumFileSize =
    10 * 1024 * 1024;


  readonly allowedExtensions = [

    '.pdf',

    '.doc',

    '.docx',

    '.xls',

    '.xlsx',

    '.png',

    '.jpg',

    '.jpeg'

  ];


  activeTab:
    InteractionTab = 'comments';


  /* =========================
     COMMENTS
     ========================= */

  comments:
    TaskComment[] = [];

  commentsLoading =
    false;

  commentError =
    '';

  creatingComment =
    false;

  editingCommentId:
    number | null = null;

  editingCommentContent =
    '';

  commentActionId:
    number | null = null;


  readonly commentForm =
    this.formBuilder
      .nonNullable
      .group({

        content: [
          '',
          [
            Validators.required,
            Validators.maxLength(1000)
          ]
        ]

      });


  /* =========================
     ATTACHMENTS
     ========================= */

  attachments:
    TaskAttachment[] = [];

  attachmentsLoading =
    false;

  attachmentError =
    '';

  selectedFile:
    File | null = null;

  uploadingAttachment =
    false;

  attachmentActionId:
    number | null = null;


  /* =========================
     INIT
     ========================= */

  ngOnInit(): void {

    this.loadComments();

    this.loadAttachments();
  }


  /* =========================
     GENERAL
     ========================= */

  setTab(
    tab:
      InteractionTab
  ): void {

    this.activeTab =
      tab;
  }


  get currentUserId():
    number | null {

    return (
      this.tokenStorage
        .getUser()
        ?.userId
      ?? null
    );
  }


  get currentUserFullName():
    string {

    return (
      this.tokenStorage
        .getUser()
        ?.fullName
      ?? 'المستخدم'
    );
  }


  get isReadOnly():
    boolean {

    return this.task
      .projectArchived;
  }


  /* =========================
     LOAD COMMENTS
     ========================= */

  loadComments(): void {

    this.commentsLoading =
      true;

    this.commentError =
      '';


    this.commentsService
      .getAll(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id
      )
      .subscribe({

        next: (
          comments:
            TaskComment[]
        ) => {

          this.comments =
            [...comments]
              .sort(
                (
                  first,
                  second
                ) =>
                  new Date(
                    first.createdAt
                  ).getTime()
                  -
                  new Date(
                    second.createdAt
                  ).getTime()
              );


          this.commentsLoading =
            false;
        },


        error: (
          error: any
        ) => {

          console.error(
            'Load comments failed:',
            error
          );


          this.commentError =
            this.extractApiError(
              error
            );


          this.commentsLoading =
            false;
        }

      });
  }


  /* =========================
     CREATE COMMENT
     ========================= */

  createComment(): void {

    if (
      this.isReadOnly ||
      this.creatingComment
    ) {
      return;
    }


    if (
      this.commentForm.invalid
    ) {

      this.commentForm
        .markAllAsTouched();

      return;
    }


    const content =
      this.commentForm
        .controls
        .content
        .value
        .trim();


    if (!content) {

      this.commentError =
        'اكتب تعليقًا قبل الإرسال.';

      return;
    }


    this.creatingComment =
      true;

    this.commentError =
      '';


    this.commentsService
      .create(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id,
        {
          content
        }
      )
      .subscribe({

        next: (
          comment:
            TaskComment
        ) => {

          this.comments = [
            ...this.comments,
            comment
          ];


          this.commentForm
            .reset({
              content: ''
            });


          this.creatingComment =
            false;
        },


        error: (
          error: any
        ) => {

          console.error(
            'Create comment failed:',
            error
          );


          this.commentError =
            this.extractApiError(
              error
            );


          this.creatingComment =
            false;
        }

      });
  }


  /* =========================
     EDIT COMMENT
     ========================= */

  canModifyComment(
    comment:
      TaskComment
  ): boolean {

    return (
      !this.isReadOnly &&
      this.currentUserId !== null &&
      comment.userId ===
        this.currentUserId
    );
  }


  startEditComment(
    comment:
      TaskComment
  ): void {

    if (
      !this.canModifyComment(
        comment
      )
    ) {
      return;
    }


    this.editingCommentId =
      comment.id;

    this.editingCommentContent =
      comment.content;

    this.commentError =
      '';
  }


  cancelEditComment(): void {

    if (
      this.commentActionId !==
      null
    ) {
      return;
    }


    this.editingCommentId =
      null;

    this.editingCommentContent =
      '';
  }


  setEditingCommentContent(
    value: string
  ): void {

    this.editingCommentContent =
      value;
  }


  saveEditedComment(
    comment:
      TaskComment
  ): void {

    if (
      !this.canModifyComment(
        comment
      ) ||
      this.commentActionId !==
      null
    ) {
      return;
    }


    const content =
      this.editingCommentContent
        .trim();


    if (!content) {

      this.commentError =
        'لا يمكن حفظ تعليق فارغ.';

      return;
    }


    if (
      content.length >
      1000
    ) {

      this.commentError =
        'التعليق لا يمكن أن يتجاوز 1000 حرف.';

      return;
    }


    this.commentActionId =
      comment.id;

    this.commentError =
      '';


    this.commentsService
      .update(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id,
        comment.id,
        {
          content
        }
      )
      .subscribe({

        next: (
          updated:
            TaskComment
        ) => {

          this.comments =
            this.comments.map(
              current =>
                current.id ===
                  updated.id

                  ? updated
                  : current
            );


          this.commentActionId =
            null;

          this.cancelEditComment();
        },


        error: (
          error: any
        ) => {

          console.error(
            'Update comment failed:',
            error
          );


          this.commentError =
            this.extractApiError(
              error
            );


          this.commentActionId =
            null;
        }

      });
  }


  /* =========================
     DELETE COMMENT
     ========================= */

  deleteComment(
    comment:
      TaskComment
  ): void {

    if (
      !this.canModifyComment(
        comment
      ) ||
      this.commentActionId !==
      null
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        'هل تريد حذف هذا التعليق؟'
      );


    if (!confirmed) {
      return;
    }


    this.commentActionId =
      comment.id;

    this.commentError =
      '';


    this.commentsService
      .delete(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id,
        comment.id
      )
      .subscribe({

        next: () => {

          this.comments =
            this.comments.filter(
              current =>
                current.id !==
                comment.id
            );


          this.commentActionId =
            null;


          if (
            this.editingCommentId ===
            comment.id
          ) {

            this.cancelEditComment();
          }
        },


        error: (
          error: any
        ) => {

          console.error(
            'Delete comment failed:',
            error
          );


          this.commentError =
            this.extractApiError(
              error
            );


          this.commentActionId =
            null;
        }

      });
  }


  /* =========================
     LOAD ATTACHMENTS
     ========================= */

  loadAttachments(): void {

    this.attachmentsLoading =
      true;

    this.attachmentError =
      '';


    this.attachmentsService
      .getAll(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id
      )
      .subscribe({

        next: (
          attachments:
            TaskAttachment[]
        ) => {

          this.attachments =
            [...attachments]
              .sort(
                (
                  first,
                  second
                ) =>
                  new Date(
                    second.createdAt
                  ).getTime()
                  -
                  new Date(
                    first.createdAt
                  ).getTime()
              );


          this.attachmentsLoading =
            false;
        },


        error: (
          error: any
        ) => {

          console.error(
            'Load attachments failed:',
            error
          );


          this.attachmentError =
            this.extractApiError(
              error
            );


          this.attachmentsLoading =
            false;
        }

      });
  }


  /* =========================
     SELECT FILE
     ========================= */

  selectFile(
    event: Event
  ): void {

    this.attachmentError =
      '';


    const input =
      event.target as
        HTMLInputElement;


    const file =
      input.files?.[0]
      ?? null;


    if (!file) {

      this.selectedFile =
        null;

      return;
    }


    const validationError =
      this.validateFile(
        file
      );


    if (
      validationError
    ) {

      this.selectedFile =
        null;

      this.attachmentError =
        validationError;

      input.value =
        '';

      return;
    }


    this.selectedFile =
      file;
  }


  clearSelectedFile(
    input?:
      HTMLInputElement
  ): void {

    if (
      this.uploadingAttachment
    ) {
      return;
    }


    this.selectedFile =
      null;

    this.attachmentError =
      '';


    if (input) {
      input.value = '';
    }
  }


  /* =========================
     UPLOAD
     ========================= */

  uploadAttachment(
    input?:
      HTMLInputElement
  ): void {

    if (
      this.isReadOnly ||
      !this.selectedFile ||
      this.uploadingAttachment
    ) {
      return;
    }


    const file =
      this.selectedFile;


    const validationError =
      this.validateFile(
        file
      );


    if (
      validationError
    ) {

      this.attachmentError =
        validationError;

      return;
    }


    this.uploadingAttachment =
      true;

    this.attachmentError =
      '';


    this.attachmentsService
      .upload(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id,
        file
      )
      .subscribe({

        next: (
          attachment:
            TaskAttachment
        ) => {

          this.attachments = [
            attachment,
            ...this.attachments
          ];


          this.uploadingAttachment =
            false;

          this.selectedFile =
            null;


          if (input) {
            input.value = '';
          }
        },


        error: (
          error: any
        ) => {

          console.error(
            'Upload attachment failed:',
            error
          );


          this.attachmentError =
            this.extractApiError(
              error
            );


          this.uploadingAttachment =
            false;
        }

      });
  }


  /* =========================
     DOWNLOAD
     ========================= */

  downloadAttachment(
    attachment:
      TaskAttachment
  ): void {

    if (
      this.attachmentActionId !==
      null
    ) {
      return;
    }


    this.attachmentActionId =
      attachment.id;

    this.attachmentError =
      '';


    this.attachmentsService
      .download(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id,
        attachment.id
      )
      .subscribe({

        next: (
          blob:
            Blob
        ) => {

          const url =
            URL.createObjectURL(
              blob
            );


          const anchor =
            document.createElement(
              'a'
            );


          anchor.href =
            url;

          anchor.download =
            attachment.fileName;


          document.body
            .appendChild(
              anchor
            );


          anchor.click();

          anchor.remove();


          URL.revokeObjectURL(
            url
          );


          this.attachmentActionId =
            null;
        },


        error: (
          error: any
        ) => {

          console.error(
            'Download attachment failed:',
            error
          );


          this.attachmentError =
            this.extractApiError(
              error
            );


          this.attachmentActionId =
            null;
        }

      });
  }


  /* =========================
     DELETE ATTACHMENT
     ========================= */

  canDeleteAttachment(
    attachment:
      TaskAttachment
  ): boolean {

    return (
      !this.isReadOnly &&
      this.currentUserId !== null &&
      attachment.userId ===
        this.currentUserId
    );
  }


  deleteAttachment(
    attachment:
      TaskAttachment
  ): void {

    if (
      !this.canDeleteAttachment(
        attachment
      ) ||
      this.attachmentActionId !==
      null
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        `هل تريد حذف المرفق "${attachment.fileName}"؟`
      );


    if (!confirmed) {
      return;
    }


    this.attachmentActionId =
      attachment.id;

    this.attachmentError =
      '';


    this.attachmentsService
      .delete(
        this.task.workspaceId,
        this.task.projectId,
        this.task.id,
        attachment.id
      )
      .subscribe({

        next: () => {

          this.attachments =
            this.attachments.filter(
              current =>
                current.id !==
                attachment.id
            );


          this.attachmentActionId =
            null;
        },


        error: (
          error: any
        ) => {

          console.error(
            'Delete attachment failed:',
            error
          );


          this.attachmentError =
            this.extractApiError(
              error
            );


          this.attachmentActionId =
            null;
        }

      });
  }


  /* =========================
     HELPERS
     ========================= */

  firstLetter(
    value:
      string |
      null |
      undefined
  ): string {

    const normalized =
      value?.trim();


    return normalized
      ? normalized
          .charAt(0)
          .toUpperCase()
      : '؟';
  }


  formatDateTime(
    value:
      string |
      null |
      undefined
  ): string {

    if (!value) {
      return '—';
    }


    return new Date(
      value
    )
      .toLocaleString(
        'ar-SY',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }


  formatFileSize(
    bytes: number
  ): string {

    if (
      bytes < 1024
    ) {

      return `${bytes} B`;
    }


    if (
      bytes <
      1024 * 1024
    ) {

      return `${
        (
          bytes / 1024
        ).toFixed(1)
      } KB`;
    }


    return `${
      (
        bytes /
        (
          1024 *
          1024
        )
      ).toFixed(1)
    } MB`;
  }


  fileExtension(
    fileName: string
  ): string {

    const parts =
      fileName.split(
        '.'
      );


    if (
      parts.length < 2
    ) {
      return 'FILE';
    }


    return parts[
      parts.length - 1
    ].toUpperCase();
  }


  private validateFile(
    file: File
  ): string | null {

    if (
      file.size <= 0
    ) {

      return 'لا يمكن رفع ملف فارغ.';
    }


    if (
      file.size >
      this.maximumFileSize
    ) {

      return 'حجم الملف لا يمكن أن يتجاوز 10 MB.';
    }


    const fileName =
      file.name
        .toLowerCase();


    const validExtension =
      this.allowedExtensions
        .some(
          extension =>
            fileName.endsWith(
              extension
            )
        );


    if (
      !validExtension
    ) {

      return 'نوع الملف غير مسموح. الأنواع المقبولة: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG.';
    }


    return null;
  }


  private extractApiError(
    error: any
  ): string {

    const errors =
      error?.error?.errors;


    if (
      errors &&
      typeof errors ===
        'object'
    ) {

      const messages =
        Object.values(
          errors
        )
          .flatMap(
            value =>
              Array.isArray(
                value
              )

                ? value
                : [value]
          )
          .filter(
            Boolean
          )
          .map(
            String
          );


      if (
        messages.length >
        0
      ) {

        return messages
          .join(
            '\n'
          );
      }
    }


    return (
      error?.error?.message
      ??
      error?.error?.detail
      ??
      error?.error?.title
      ??
      error?.message
      ??
      'حدث خطأ غير متوقع.'
    );
  }

}