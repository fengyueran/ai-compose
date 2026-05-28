import styled from "@emotion/styled";
import {
  actionButtonStyles,
  formControlStyles,
} from "../../../shared";

export const AddSourceModalContent = styled.div`
  ${actionButtonStyles}
  ${formControlStyles}

  display: flex;
  flex-direction: column;
  gap: 14px;

  .mcp-form__btn {
    min-height: 32px;
    border-radius: 6px;
  }
`;
