output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}
output "cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = module.eks.cluster_endpoint
}
output "region" {
    description = "AWS region"
    value       = var.region
}