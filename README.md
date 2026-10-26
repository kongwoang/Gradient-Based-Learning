# Gradient-Based Learning

Repo đọc paper, ghi comment và reproduce các phương pháp học dựa trên gradient.

**[Bảng comment](papers/COMMENTS.md)** — một dòng mỗi bài, cập nhật trực tiếp trên GitHub.

```text
papers/
├── MTL/          # Multi-task learning
├── CL/           # Continual learning
├── Multimodal/
├── DG/           # Domain generalization
├── FL/           # Federated learning
└── COMMENTS.md
```

Mỗi bài là một folder `Venue-Year_Topic_Method/`, gồm PDF cùng tên và README ngắn với link nguồn/code tác giả. Khi reproduce, thêm `code/` trong folder bài đó; ghi cách chạy và kết quả vào README của bài. Dataset, checkpoint và log không đưa lên Git.

## Danh sách bài

| # | Topic | Venue | Method / bài | Hướng nghiên cứu |
|---|---|---|---|---|
| 1 | MTL | ICML 2018 | [GradNorm](papers/MTL/ICML-2018_MTL_GradNorm/) | Gradient balancing |
| 2 | MTL | NeurIPS 2020 | [PCGrad](papers/MTL/NeurIPS-2020_MTL_PCGrad/) | Gradient surgery / conflict |
| 3 | MTL | NeurIPS 2021 | [CAGrad](papers/MTL/NeurIPS-2021_MTL_CAGrad/) | Multi-objective optimization |
| 4 | MTL | ICLR 2022 | [RotoGrad](papers/MTL/ICLR-2022_MTL_RotoGrad/) | Gradient magnitude & direction |
| 5 | CL | ICLR 2021 | [GPM](papers/CL/ICLR-2021_CL_GPM/) | Orthogonal gradient projection |
| 6 | CL | CVPR 2022 | [GCR](papers/CL/CVPR-2022_CL_GCR/) | Gradient-based replay |
| 7 | CL | NeurIPS 2022 | [SparCL](papers/CL/NeurIPS-2022_CL_SparCL/) | Gradient sparsification |
| 8 | CL | AAAI 2023 | [SGP](papers/CL/AAAI-2023_CL_SGP/) | Scaled gradient projection |
| 9 | CL | CVPR 2023 | [SD](papers/CL/CVPR-2023_CL_SD/) | Feature space decoupling |
| 10 | CL | ICLR 2026 | [KeepLoRA](papers/CL/ICLR-2026_CL_KeepLoRA/) | Residual gradient / LoRA |
| 11 | Multimodal | CVPR 2022 | [OGM-GE](papers/Multimodal/CVPR-2022_Multimodal_OGM-GE/) | Gradient modulation |
| 12 | Multimodal | NeurIPS 2022 | [Cross-Modality Gradient Harmonization](papers/Multimodal/NeurIPS-2022_Multimodal_Cross-Modality-Gradient-Harmonization/) | Gradient harmonization |
| 13 | Multimodal | ICCV 2023 | [AGM](papers/Multimodal/ICCV-2023_Multimodal_AGM/) | Adaptive gradient modulation |
| 14 | Multimodal | NeurIPS 2024 | [CGGM](papers/Multimodal/NeurIPS-2024_Multimodal_CGGM/) | Gradient magnitude & direction |
| 15 | Multimodal | ICCV 2025 | [DGL](papers/Multimodal/ICCV-2025_Multimodal_DGL/) | Gradient flow decoupling |
| 16 | DG | ICML 2022 | [Fishr](papers/DG/ICML-2022_DG_Fishr/) | Gradient variance matching |
| 17 | DG | CVPR 2023 | [SAGM](papers/DG/CVPR-2023_DG_SAGM/) | Sharpness-aware optimization |
| 18 | DG | CVPR 2025 | [GGA](papers/DG/CVPR-2025_DG_GGA/) | Gradient alignment / annealing |
| 19 | FL | CVPR 2023 | [GradMA](papers/FL/CVPR-2023_FL_GradMA/) | Gradient memory / update correction |

Thêm bài: tạo folder theo quy ước trên, thêm một dòng vào danh sách và bảng comment.

Tham khảo cách tổ chức: [Papers We Love](https://github.com/papers-we-love/papers-we-love), [Deep Learning Paper Notes](https://github.com/cjmcv/deeplearning-paper-notes). PDF thuộc tác giả và đơn vị xuất bản tương ứng.
